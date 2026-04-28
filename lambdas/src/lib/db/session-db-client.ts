import { type ISession, type ISessionUserInfo } from "../models/session/session";
import { type DBClient, type DbResult } from "./db-client";
import { type DbRetryOptions, executeDbOperationWithRetry } from "./db-retry";

type SessionTimestamp = Date | string;
type SessionQueryValue = boolean | SessionTimestamp | string;

interface SessionUpdateDefinition {
  column: string;
  value: SessionQueryValue | undefined;
  cast?: string;
}

interface SessionRow {
  session_id: string;
  refresh_token_id: string;
  nhs_access_token: string;
  issuer: string;
  audience: string;
  subject: string;
  family_name: string;
  given_name: string;
  identity_proofing_level: string;
  email: string;
  email_verified: boolean;
  phone_number: string;
  phone_number_verified: boolean;
  birth_date: string;
  nhs_number: string;
  gp_ods_code: string;
  session_created_at: SessionTimestamp;
  last_refresh_at: SessionTimestamp;
  max_expires_at: SessionTimestamp;
}

export interface CreateSessionInput {
  sessionId: string;
  refreshTokenId: string;
  nhsAccessToken: string;
  userInfo: ISessionUserInfo;
  sessionCreatedAt: string;
  lastRefreshAt: string;
  maxExpiresAt: string;
}

export interface UpdateSessionInput {
  refreshTokenId?: string;
  nhsAccessToken?: string;
  lastRefreshAt?: string;
  maxExpiresAt?: string;
}

const SESSION_COLUMNS = `
      session_id,
      refresh_token_id,
      nhs_access_token,
      issuer,
      audience,
      subject,
      family_name,
      given_name,
      identity_proofing_level,
      email,
      email_verified,
      phone_number,
      phone_number_verified,
      birth_date,
      nhs_number,
      gp_ods_code,
      session_created_at,
      last_refresh_at,
      max_expires_at
`;

export class SessionDbClient {
  constructor(
    private readonly dbClient: DBClient,
    private readonly retryOptions: Partial<DbRetryOptions> = {},
  ) {}

  async createSession(session: CreateSessionInput): Promise<ISession> {
    const query = `
      INSERT INTO session (
        session_id,
        refresh_token_id,
        nhs_access_token,
        issuer,
        audience,
        subject,
        family_name,
        given_name,
        identity_proofing_level,
        email,
        email_verified,
        phone_number,
        phone_number_verified,
        birth_date,
        nhs_number,
        gp_ods_code,
        session_created_at,
        last_refresh_at,
        max_expires_at
      )
      VALUES (
        $1::uuid,
        $2::uuid,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14::date,
        $15,
        $16,
        $17::timestamptz,
        $18::timestamptz,
        $19::timestamptz
      )
      -- Intentionally use a plain INSERT here.
      -- We do not use ON CONFLICT ... DO UPDATE for session creation because a true
      -- session_id or refresh_token_id collision must never overwrite another user's session.
      -- A future ticket will add safe recovery for ambiguous duplicate-key failures that can
      -- happen after a transient connection error during session creation.
      RETURNING ${SESSION_COLUMNS};
    `;

    const values: SessionQueryValue[] = [
      session.sessionId,
      session.refreshTokenId,
      session.nhsAccessToken,
      session.userInfo.issuer,
      session.userInfo.audience,
      session.userInfo.subject,
      session.userInfo.familyName,
      session.userInfo.givenName,
      session.userInfo.identityProofingLevel,
      session.userInfo.email,
      session.userInfo.emailVerified,
      session.userInfo.phoneNumber,
      session.userInfo.phoneNumberVerified,
      session.userInfo.birthDate,
      session.userInfo.nhsNumber,
      session.userInfo.gpOdsCode,
      session.sessionCreatedAt,
      session.lastRefreshAt,
      session.maxExpiresAt,
    ];

    try {
      const result = await this.query<SessionRow, SessionQueryValue[]>(query, values);

      if (result.rowCount === 0 || !result.rows[0]) {
        throw new Error("Failed to create session");
      }

      return this.mapRowToSession(result.rows[0]);
    } catch {
      throw new Error(`Failed to create session for sessionId ${session.sessionId}`);
    }
  }

  async getSession(sessionId: string): Promise<ISession | null> {
    const query = `
      SELECT ${SESSION_COLUMNS}
      FROM session
      WHERE session_id = $1::uuid
      LIMIT 1;
    `;

    try {
      const result = await this.query<SessionRow, [string]>(query, [sessionId]);

      return result.rowCount === 0 || !result.rows[0] ? null : this.mapRowToSession(result.rows[0]);
    } catch {
      throw new Error(`Failed to fetch session for sessionId ${sessionId}`);
    }
  }

  async updateSession(sessionId: string, updates: UpdateSessionInput): Promise<ISession> {
    const { setClauses, values } = this.buildUpdateClauses(updates);

    if (setClauses.length === 0) {
      throw new Error(`No session updates provided for sessionId ${sessionId}`);
    }

    values.push(sessionId);

    const query = `
      UPDATE session
      SET
        ${setClauses.join(",\n        ")}
      WHERE session_id = $${values.length}::uuid
      RETURNING ${SESSION_COLUMNS};
    `;

    try {
      const result = await this.query<SessionRow, SessionQueryValue[]>(query, values);

      if (result.rowCount === 0 || !result.rows[0]) {
        throw new Error("Failed to update session");
      }

      return this.mapRowToSession(result.rows[0]);
    } catch {
      throw new Error(`Failed to update session for sessionId ${sessionId}`);
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const query = `
      DELETE FROM session
      WHERE session_id = $1::uuid;
    `;

    try {
      const result = await this.query<SessionRow, [string]>(query, [sessionId]);

      if (result.rowCount === 0) {
        throw new Error("Failed to delete session");
      }
    } catch {
      throw new Error(`Failed to delete session for sessionId ${sessionId}`);
    }
  }

  private async query<T, I extends unknown[]>(text: string, values: I): Promise<DbResult<T>> {
    return executeDbOperationWithRetry(
      () => this.dbClient.query<T, I>(text, values),
      this.retryOptions,
    );
  }

  private buildUpdateClauses(updates: UpdateSessionInput): {
    setClauses: string[];
    values: SessionQueryValue[];
  } {
    // This ordered whitelist is the source of truth for mutable session fields.
    // SQL assignments and bound values are both derived from it so placeholder ordering is explicit.
    const updatesToApply = this.buildMutableFieldUpdates(updates).filter(
      (update): update is { column: string; value: SessionQueryValue; cast?: string } =>
        update.value !== undefined,
    );

    return {
      setClauses: updatesToApply.map((update, index) => {
        const placeholder = this.buildPlaceholder(index + 1, update.cast);
        return `${update.column} = ${placeholder}`;
      }),
      values: updatesToApply.map((update) => update.value),
    };
  }

  private buildMutableFieldUpdates(updates: UpdateSessionInput): SessionUpdateDefinition[] {
    return [
      {
        column: "refresh_token_id",
        value: updates.refreshTokenId,
        cast: "uuid",
      },
      {
        column: "nhs_access_token",
        value: updates.nhsAccessToken,
      },
      {
        column: "last_refresh_at",
        value: updates.lastRefreshAt,
        cast: "timestamptz",
      },
      {
        column: "max_expires_at",
        value: updates.maxExpiresAt,
        cast: "timestamptz",
      },
    ];
  }

  private buildPlaceholder(parameterIndex: number, cast?: string): string {
    return cast ? `$${parameterIndex}::${cast}` : `$${parameterIndex}`;
  }

  private mapRowToSession(row: SessionRow): ISession {
    return {
      sessionId: row.session_id,
      refreshTokenId: row.refresh_token_id,
      nhsAccessToken: row.nhs_access_token,
      userInfo: {
        issuer: row.issuer,
        audience: row.audience,
        subject: row.subject,
        familyName: row.family_name,
        givenName: row.given_name,
        identityProofingLevel: row.identity_proofing_level,
        email: row.email,
        emailVerified: row.email_verified,
        phoneNumber: row.phone_number,
        phoneNumberVerified: row.phone_number_verified,
        birthDate: row.birth_date,
        nhsNumber: row.nhs_number,
        gpOdsCode: row.gp_ods_code,
      },
      sessionCreatedAt: this.normalizeTimestamp(row.session_created_at),
      lastRefreshAt: this.normalizeTimestamp(row.last_refresh_at),
      maxExpiresAt: this.normalizeTimestamp(row.max_expires_at),
    };
  }

  private normalizeTimestamp(value: SessionTimestamp): string {
    return value instanceof Date ? value.toISOString() : value;
  }
}
