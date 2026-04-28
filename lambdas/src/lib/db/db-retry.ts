import { randomInt } from "node:crypto";

export interface DbRetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  backoffFactor: number;
  maxDelayMs: number;
  jitter: boolean;
  isRetryable: (error: unknown) => boolean;
}

interface DbRetryError extends Error {
  code?: string;
  errno?: string;
}

const TRANSIENT_POSTGRES_ERROR_CLASS_PREFIXES = new Set(["08"]);

// Transient network error codes that are safe to retry.
// These are POSIX system error codes surfaced by Node.js as `error.code` on
// failed socket/HTTP operations. All five are documented in the Node.js
// "Common system errors" section:
// https://nodejs.org/docs/latest-v24.x/api/errors.html#common-system-errors
//
//  ECONNREFUSED – target actively refused the connection (service restarting)
//  ECONNRESET   – connection forcibly closed by peer (timeout / reboot)
//  ENOTFOUND    – DNS lookup failed (EAI_NODATA / EAI_NONAME)
//  EPIPE        – remote end of stream closed while writing
//  ETIMEDOUT    – connected party did not respond in time
const TRANSIENT_NETWORK_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EPIPE",
  "ETIMEDOUT",
]);

// PostgreSQL Appendix A documents all Class 08 SQLSTATEs as connection exceptions, so we retry
// the whole class by prefix rather than maintaining a partial list. We additionally retry only the
// transient Class 57 restart or shutdown codes below, not the full Class 57 operator-intervention
// family.
// Source: https://www.postgresql.org/docs/current/errcodes-appendix.html
const TRANSIENT_POSTGRES_ERROR_CODES = new Set(["57P01", "57P02", "57P03"]);

// Note: unique-violation conflicts (for example PostgreSQL 23505) are intentionally not treated
// as retryable here. The generic retry layer cannot distinguish a replay of the same successful
// write after a transient connection failure from a genuine duplicate-key conflict. Session create
// recovery for that case is deferred to a dedicated follow-up change.

const TRANSIENT_ERROR_PATTERNS = [
  /cannot connect now/i,
  /connection terminated unexpectedly/i,
  /server closed the connection unexpectedly/i,
  /the database system is starting up/i,
  /terminating connection due to administrator command/i,
];

export const DEFAULT_DB_RETRY_OPTIONS: DbRetryOptions = {
  maxRetries: 2,
  initialDelayMs: 200,
  backoffFactor: 2,
  maxDelayMs: 1_000,
  jitter: true,
  isRetryable: isTransientDatabaseError,
};

export function isTransientDatabaseError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const dbError = error as DbRetryError;
  const errorCode = dbError.code ?? dbError.errno;

  if (errorCode && TRANSIENT_NETWORK_ERROR_CODES.has(errorCode)) {
    return true;
  }

  if (errorCode && isTransientPostgresErrorCode(errorCode)) {
    return true;
  }

  if (/timeout expired/i.test(error.message)) {
    return false;
  }

  return TRANSIENT_ERROR_PATTERNS.some((pattern) => pattern.test(error.message));
}

function isTransientPostgresErrorCode(errorCode: string): boolean {
  return (
    TRANSIENT_POSTGRES_ERROR_CODES.has(errorCode) ||
    [...TRANSIENT_POSTGRES_ERROR_CLASS_PREFIXES].some((prefix) => errorCode.startsWith(prefix))
  );
}

export async function executeDbOperationWithRetry<T>(
  operation: () => Promise<T>,
  retryOptions: Partial<DbRetryOptions> = {},
): Promise<T> {
  const options = buildDbRetryOptions(retryOptions);
  let retryCount = 0;

  for (;;) {
    try {
      return await operation();
    } catch (error) {
      if (retryCount >= options.maxRetries || !options.isRetryable(error)) {
        throw error;
      }

      retryCount += 1;
      await wait(getRetryDelayMs(retryCount, options));
    }
  }
}

function buildDbRetryOptions(retryOptions: Partial<DbRetryOptions>): DbRetryOptions {
  return {
    ...DEFAULT_DB_RETRY_OPTIONS,
    ...retryOptions,
    isRetryable: retryOptions.isRetryable ?? DEFAULT_DB_RETRY_OPTIONS.isRetryable,
  };
}

// With DEFAULT_DB_RETRY_OPTIONS (initialDelayMs=200, backoffFactor=2, maxDelayMs=1000, jitter=true):
//   retry 1: exponentialDelay = min(200 × 2⁰, 1000) = 200 ms → jitter range [100, 199] ms
//   retry 2: exponentialDelay = min(200 × 2¹, 1000) = 400 ms → jitter range [200, 399] ms
function getRetryDelayMs(retryCount: number, options: DbRetryOptions): number {
  const exponentialDelay = Math.min(
    options.initialDelayMs * options.backoffFactor ** (retryCount - 1),
    options.maxDelayMs,
  );

  if (!options.jitter) {
    return exponentialDelay;
  }

  const jitterFloor = Math.max(0, Math.ceil(exponentialDelay / 2));
  const jitterCeiling = Math.max(0, Math.ceil(exponentialDelay));

  // randomInt() requires integer bounds with min < max. If a custom retry configuration
  // produces a zero-width or non-integer range, fall back to the non-jittered delay rather
  // than failing the retry path itself.
  if (
    !Number.isSafeInteger(jitterFloor) ||
    !Number.isSafeInteger(jitterCeiling) ||
    jitterFloor >= jitterCeiling
  ) {
    return exponentialDelay;
  }

  return randomInt(jitterFloor, jitterCeiling);
}

async function wait(delayMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}
