---
applyTo: "lambdas/**"
---

# Lambda Instructions

## Overview

All backend logic runs as AWS Lambda functions (Node.js ESM). Lambdas are built with esbuild
and deployed via AWS API Gateway. Shared utilities live in `src/lib/`.

## Structure

```text
lambdas/src/
├── <name>-lambda/        # One directory per lambda
│   ├── index.ts          # Handler entrypoint — always named index.ts
│   ├── init.ts           # Dependency injection factory
│   └── schemas.ts / *-schema.ts  # Zod request/response schemas
└── lib/
    ├── auth/             # JWT verification, NHS Login OIDC
    ├── db/               # DBClient, typed DB repository classes
    ├── http/             # HTTP utilities
    ├── models/           # Shared domain types and interfaces
    ├── security/         # Security helpers
    ├── sqs/              # SQS client wrapper
    ├── types/            # Shared TypeScript types
    ├── utils/            # createJsonResponse, correlationId, etc.
    └── validators/       # Shared Zod validators
```

## Handler Pattern

Lambdas can be invoked via a variety of methods:

- SQS message
- Scheduled event
- API Gateway HTTP API
- Manual invocation from another lambda

Lambda handlers are wrapped in Middy middleware to add common functionality.

Use this as the preferred structure for new lambdas:

```typescript
import middy from "@middy/core";

import { init } from "./init";

export const lambdaHandler = async (event: unknown): Promise<void> => {
  const { myService } = await init();
  // parse + validate request with Zod
  // call services
  // return response if needed
};

export const handler = middy(lambdaHandler);
```

Key rules:

- The internal function is always `lambdaHandler` (named export).
- The Middy-wrapped export is always `handler` (the actual Lambda entrypoint).
- Import `init` at module scope, but call `init()` inside `lambdaHandler`. `init()` must be singleton-cached, so dependencies are still constructed once per cold start.

### HTTP API Gateway

When a lambda is invoked via the HTTP API, wrap the handler with the following Middy middleware in this order:

```typescript
import middy from "@middy/core";
import cors from "@middy/http-cors";
import httpErrorHandler from "@middy/http-error-handler";
import httpSecurityHeaders from "@middy/http-security-headers";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

import { securityHeaders } from "../lib/http/security-headers";
import { defaultCorsOptions } from "../lib/security/cors-configuration";
import { createJsonResponse, getCorrelationIdFromEventHeaders } from "../lib/utils/utils";
import { init } from "./init";

const name = "my-lambda";

export const lambdaHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const { myService } = await init();
  const correlationId = getCorrelationIdFromEventHeaders(event);
  // parse + validate request with Zod
  // call services
  console.info(name, "Request received", { correlationId });
  // return response
  return createJsonResponse(200, { result }, { "X-Correlation-ID": correlationId });
};

export const handler = middy(lambdaHandler)
  .use(httpSecurityHeaders(securityHeaders))
  .use(cors(defaultCorsOptions))
  .use(httpErrorHandler());
```

- Middy middleware order is always: `httpSecurityHeaders` → `cors` → `httpErrorHandler`.
  - `cors` is only required if the HTTP request is coming from a browser.
  - `httpSecurityHeaders` and `httpErrorHandler` are always required.
- Always pass the shared config objects: `httpSecurityHeaders(securityHeaders)` and `cors(defaultCorsOptions)` — never inline options.
- Echo `X-Correlation-ID` in the response header for all JSON responses. FHIR-response lambdas (using `createFhirResponse`) do not set this header — that is an accepted divergence.
- Use `createJsonResponse(statusCode, body, extraHeaders?)` for all JSON responses — never construct the response object manually.
- For lambdas that return FHIR resources, use `createFhirResponse` / `createFhirErrorResponse` from `../lib/fhir-response` instead of `createJsonResponse`.

## Dependency Injection via `init()`

Each lambda has its own `init.ts` that constructs and returns all dependencies. This keeps the
handler pure and testable. `buildEnvironment()` constructs dependencies; `init()` is the cached
public entrypoint used by handlers.

```typescript
// init.ts
import { PostgresDbClient } from "../lib/db/db-client";
import { postgresConfigFromEnv } from "../lib/db/db-config";
import { OrderDbClient } from "../lib/db/order-db-client";
import { AwsSecretsClient } from "../lib/secrets/secrets-manager-client";
import { retrieveMandatoryEnvVariable } from "../lib/utils/utils";

export interface Environment {
  orderDbClient: OrderDbClient;
}

export function buildEnvironment(): Environment {
  const secretsClient = new AwsSecretsClient(retrieveMandatoryEnvVariable("AWS_REGION"));
  const dbClient = new PostgresDbClient(postgresConfigFromEnv(secretsClient));
  const orderDbClient = new OrderDbClient(dbClient);
  return { orderDbClient };
}

let _env: Environment | undefined;

export function init(): Environment {
  _env ??= buildEnvironment();
  return _env;
}
```

For async dependency construction, cache the Promise and clear it on rejection so later calls can
retry:

```typescript
let _env: Promise<Environment> | undefined;

export function init(): Promise<Environment> {
  _env ??= buildEnvironment().catch((error) => {
    _env = undefined;
    throw error;
  });
  return _env;
}
```

Rules:

- Handlers must call `init()`, not `buildEnvironment()`.
- Keep `buildEnvironment()` exported for focused `init.test.ts` coverage.
- Use `??=` for singleton caching.

## Environment Variables

All environment variable reads in lambda code must go through the helpers in
`../lib/utils/utils`. Never read `process.env` directly in handler or service code.

| Helper                                                  | Use when                                                                     |
| ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `retrieveMandatoryEnvVariable(name)`                    | Variable must be present; throws if absent or empty string                   |
| `retrieveOptionalEnvVariable(name)`                     | Variable may be absent; returns `string \| undefined`, treats `""` as absent |
| `retrieveOptionalEnvVariableWithDefault(name, default)` | Variable may be absent; returns the provided default when absent or empty    |

Key rules:

- All env var reads belong in `init.ts` / `buildEnvironment()`, not at module scope and not inside handlers.
- `retrieveMandatoryEnvVariable` and `retrieveOptionalEnvVariableWithDefault` both treat an empty string the same as an absent variable — they will never return `""`.
- `retrieveOptionalEnvVariable` also returns `undefined` for an empty string, so callers can use `??` safely.
- Never use a default value for a mandatory variable. If the variable must be present in production, use `retrieveMandatoryEnvVariable`.
- `AWS_REGION` is always mandatory — the Lambda runtime always provides it. Use `retrieveMandatoryEnvVariable("AWS_REGION")`.
- The only permitted direct `process.env` reads are in `src/lib/utils/utils.ts` (the helpers themselves) and `src/lib/aws/aws-client-config.ts` is covered by `retrieveOptionalEnvVariable`.

```typescript
// init.ts — correct patterns
import {
  retrieveMandatoryEnvVariable,
  retrieveOptionalEnvVariable,
  retrieveOptionalEnvVariableWithDefault,
} from "../lib/utils/utils";

const region = retrieveMandatoryEnvVariable("AWS_REGION");
const queueUrl = retrieveMandatoryEnvVariable("ORDER_PLACEMENT_QUEUE_URL");
const sqsEndpoint = retrieveOptionalEnvVariable("SQS_ENDPOINT"); // string | undefined
const timeoutMs = Number(retrieveOptionalEnvVariableWithDefault("TIMEOUT_MS", "5000"));
```

## Request Validation

Use Zod to validate all incoming payloads at the handler boundary. Define schemas in a
co-located file — either `schemas.ts` (for lambdas with a single schema) or
`<name>-schema.ts` (for lambdas with multiple schemas or complex types).

```typescript
import { z } from "zod";

export const CreateOrderRequestSchema = z.object({
  nhsNumber: z.string().min(10).max(10),
  testCode: z.string(),
});

export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;
```

Parse in the handler:

```typescript
const parsed = CreateOrderRequestSchema.safeParse(JSON.parse(event.body ?? "{}"));
if (!parsed.success) {
  return createJsonResponse(400, { error: z.prettifyError(parsed.error) });
}
```

## HTTP Client

For any outbound HTTP calls from a lambda, always use an implementation of `HttpClient` from `../lib/http/http-client`. The implementation of that `HttpClient` can be use-case specific, it might be the `FetchHttpClient` or it might be another implementation.
Never use `axios`, `undici` directly, or bare `fetch` in handler or service code.

```typescript
import { FetchHttpClient, type HttpClient } from "../lib/http/http-client";

// In init.ts — construct once and inject
const httpClient: HttpClient = new FetchHttpClient();

// Usage — typed response, error handling built in
const result = await httpClient.get<MyResponseType>(url, { "X-Correlation-ID": correlationId });
const result = await httpClient.post<MyResponseType>(url, requestBody, { "X-Correlation-ID": correlationId });
```

`FetchHttpClient` throws `HttpError` (with `status` and `body` properties) on non-2xx
responses — catch it explicitly where you need to handle specific status codes.

```typescript
import { HttpError } from "../lib/http/http-client";

try {
  return await httpClient.get<MyResponse>(url);
} catch (error) {
  if (error instanceof HttpError && error.status === 404) {
    return null;
  }
  throw error;
}
```

Use `postRaw()` only when you need access to the raw `Response` object (e.g. to inspect
headers or stream the body). Prefer the typed `post<T>()` in all other cases.

## Database Layer

- Always use the `DBClient` interface — never import `pg` `Pool` or `Client` directly in
  handler or service code.
- All DB access is via typed repository classes (e.g. `OrderDbClient`, `TestResultDbClient`).
- All SQL must be parameterised. Never concatenate or interpolate user input into SQL.
- Use `withTransaction()` for multi-step operations.

```typescript
// Correct — parameterised
const result = await this.dbClient.query<Order, [string, string, Date]>(
  `SELECT * FROM test_order WHERE order_uid = $1::uuid AND nhs_number = $2 AND birth_date = $3::date`,
  [orderId, nhsNumber, dateOfBirth],
);

// WRONG — never do this
const result = await this.dbClient.query(`SELECT * FROM test_order WHERE id = '${orderId}'`);
```

## Logging

- Use `console.info` for operational log points (request received, key steps completed).
- Use `console.error` for genuine runtime errors only.
- Never use `console.log` anywhere in production lambda code.
- Always include the lambda `name` constant and `correlationId` in log calls for traceability in all new and migrated code.
- Never include NHS numbers, dates of birth, full names, or test results in log messages.
- Any existing production lambdas or shared modules that still use `console.log` are considered **legacy** and MUST be migrated to use `console.info` / `console.error` when touched. Do not copy or extend those patterns.

```typescript
const name = "order-service-lambda";

// Operational info
console.info(name, "Order created successfully", { correlationId, orderUid });

// Errors only
console.error(name, "Failed to enqueue order", { correlationId, error });
```

## Testing Requirements

Every lambda must have:

1. **Unit tests** — `src/<name>-lambda/<name>.test.ts` (Jest + ts-jest). Mock all AWS SDK
   calls and DB clients.
2. **Integration tests** — `src/<name>-lambda/<name>.integration.test.ts` (Jest +
   `@testcontainers/postgresql`). Spin up a real Postgres container; do not mock the DB layer. (optional, confirm with developer)

Every `lib/` module must have a co-located unit test (`*.test.ts`).

Each `init.ts` should also have an `init.test.ts` covering:

- dependency wiring/configuration
- AWS region precedence
- singleton protection
- rejection retry when async `init()` caches a Promise

Test pattern:

- Sync singleton init modules: use `jest.isolateModules()` where a fresh module instance is needed.
- Async init modules that read env vars at module load: use `jest.resetModules()` in `beforeEach` and import `./init` inside each test after env and mocks are configured.

```typescript
// Unit test pattern
import { OrderDbClient } from "../lib/db/order-db-client";
import { lambdaHandler } from "./index";

jest.mock("./init");

describe("myLambda", () => {
  it("returns 200 for a valid request", async () => {
    const mockEvent = {
      body: JSON.stringify({
        /* ... */
      }),
    } as APIGatewayProxyEvent;
    const result = await lambdaHandler(mockEvent);
    expect(result.statusCode).toBe(200);
  });
});
```

## File Naming

- Lambda entrypoints: `src/<kebab-case-name>-lambda/index.ts`
- Lib utilities: `src/lib/<module>/<kebab-case-name>.ts`
- Classes: PascalCase filename matching the class name (e.g. `OrderDbClient` → `order-db-client.ts`)
- Test files: co-located alongside the source file they test
