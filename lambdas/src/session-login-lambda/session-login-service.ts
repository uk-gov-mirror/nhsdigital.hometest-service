import { randomUUID } from "node:crypto";

import { type ISessionTokenService } from "../lib/auth/session-token-service";
import { type SessionDbClient } from "../lib/db/session-db-client";
import { type INhsLoginService, type NhsLoginErrorCode } from "../lib/login/nhs-login-service";
import { ISessionUserInfo, mapNhsUserInfoToSessionUserInfo } from "../lib/models/session/session";

export interface SessionLoginSuccessResult {
  userInfo: ISessionUserInfo;
  sessionId: string;
  refreshTokenId: string;
  sessionCreatedAt: string;
  signedAccessToken: string;
  signedRefreshToken: string;
}

export type SessionLoginErrorCode =
  | NhsLoginErrorCode
  | "ID_TOKEN_ISS_MISSING"
  | "ID_TOKEN_AUD_INVALID"
  | "SESSION_DATA_INVALID"
  | "SESSION_PERSIST_FAILED";

export interface SessionLoginError {
  code: SessionLoginErrorCode;
  message: string;
}

export interface SessionLoginSuccess {
  success: true;
  result: SessionLoginSuccessResult;
}

export interface SessionLoginFailure {
  success: false;
  error: SessionLoginError;
}

export type SessionLoginExecutionResult = SessionLoginSuccess | SessionLoginFailure;

export interface ISessionLoginService {
  executeCallback: (code: string) => Promise<SessionLoginExecutionResult>;
}

export type SessionLoginSessionDbClient = Pick<SessionDbClient, "createSession">;

export interface SessionLoginServiceParams {
  nhsLoginService: INhsLoginService;
  sessionDbClient: SessionLoginSessionDbClient;
  sessionTokenService: ISessionTokenService;
  sessionMaxDurationMinutes: number;
  uuidGenerator?: () => string;
  clock?: () => Date;
}

export class SessionLoginService implements ISessionLoginService {
  private readonly nhsLoginService: INhsLoginService;
  private readonly sessionDbClient: SessionLoginSessionDbClient;
  private readonly sessionTokenService: ISessionTokenService;
  private readonly sessionMaxDurationMinutes: number;
  private readonly uuidGenerator: () => string;
  private readonly clock: () => Date;

  constructor(params: SessionLoginServiceParams) {
    this.nhsLoginService = params.nhsLoginService;
    this.sessionDbClient = params.sessionDbClient;
    this.sessionTokenService = params.sessionTokenService;
    this.sessionMaxDurationMinutes = params.sessionMaxDurationMinutes;
    this.uuidGenerator = params.uuidGenerator ?? randomUUID; // dependency injection allows for easier testing, but default to crypto.randomUUID if not provided
    this.clock = params.clock ?? (() => new Date()); // dependency injection allows for easier testing, but default to current time if not provided
  }

  public async executeCallback(code: string): Promise<SessionLoginExecutionResult> {
    const nhsLoginResult = await this.nhsLoginService.executeCallback(code);

    if (!nhsLoginResult.success) {
      return nhsLoginResult;
    }

    const idTokenIssuer = nhsLoginResult.result.idTokenIssuer?.trim();

    if (!idTokenIssuer) {
      return this.failure(
        "ID_TOKEN_ISS_MISSING",
        "NHS identity token is missing a required issuer claim",
      );
    }

    const idTokenAudience = this.normaliseAudience(nhsLoginResult.result.idTokenAudience);

    if (!idTokenAudience) {
      return this.failure(
        "ID_TOKEN_AUD_INVALID",
        "NHS identity token has an invalid audience claim",
      );
    }

    const sessionId = this.uuidGenerator();
    const refreshTokenId = this.uuidGenerator();
    const sessionCreatedAt = this.clock().toISOString();
    const lastRefreshAt = sessionCreatedAt;
    const maxExpiresAt = new Date(
      Date.parse(sessionCreatedAt) + this.sessionMaxDurationMinutes * 60_000,
    ).toISOString();

    if (!(Date.parse(maxExpiresAt) > Date.parse(sessionCreatedAt))) {
      return this.failure(
        "SESSION_DATA_INVALID",
        "Session expiry configuration produced an invalid maximum expiry time",
      );
    }

    const userInfo = mapNhsUserInfoToSessionUserInfo(nhsLoginResult.result.userInfo);
    userInfo.issuer = idTokenIssuer;
    userInfo.audience = idTokenAudience;

    if (!this.isValidSessionUserInfo(userInfo)) {
      return this.failure(
        "SESSION_DATA_INVALID",
        "NHS user information is missing required session fields",
      );
    }

    try {
      await this.sessionDbClient.createSession({
        sessionId,
        refreshTokenId,
        nhsAccessToken: nhsLoginResult.result.nhsAccessToken,
        userInfo,
        sessionCreatedAt,
        lastRefreshAt,
        maxExpiresAt,
      });
    } catch {
      return this.failure(
        "SESSION_PERSIST_FAILED",
        "Unable to create a preview session after successful NHS Login authentication",
      );
    }

    const signedAccessToken = this.sessionTokenService.signAccessToken({
      sessionId,
      sessionCreatedAt,
    });
    const signedRefreshToken = this.sessionTokenService.signRefreshToken({
      refreshTokenId,
    });

    return {
      success: true,
      result: {
        userInfo,
        sessionId,
        refreshTokenId,
        sessionCreatedAt,
        signedAccessToken,
        signedRefreshToken,
      },
    };
  }

  private normaliseAudience(audience: string | string[] | undefined): string | undefined {
    if (typeof audience !== "string") {
      return undefined;
    }

    const trimmedAudience = audience.trim();
    return trimmedAudience.length > 0 ? trimmedAudience : undefined;
  }

  private isValidSessionUserInfo(userInfo: ISessionUserInfo): boolean {
    return (
      this.hasValue(userInfo.issuer) &&
      this.hasValue(userInfo.audience) &&
      this.hasValue(userInfo.subject) &&
      this.hasValue(userInfo.familyName) &&
      this.hasValue(userInfo.givenName) &&
      this.hasValue(userInfo.identityProofingLevel) &&
      this.hasValue(userInfo.email) &&
      this.hasValue(userInfo.birthDate) &&
      this.hasValue(userInfo.gpOdsCode) &&
      /^[0-9]{10}$/.test(userInfo.nhsNumber)
    );
  }

  private hasValue(value: string): boolean {
    return value.trim().length > 0;
  }

  private failure(code: SessionLoginErrorCode, message: string): SessionLoginFailure {
    return {
      success: false,
      error: {
        code,
        message,
      },
    };
  }
}
