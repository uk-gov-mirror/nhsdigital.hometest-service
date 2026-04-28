import jwt, {
  JsonWebTokenError,
  type JwtHeader,
  type JwtPayload,
  TokenExpiredError,
  type VerifyOptions,
} from "jsonwebtoken";

import {
  type ISessionAccessTokenPayload,
  type ISessionRefreshTokenPayload,
} from "../models/auth/session-token-payload";
import { cleanupKey } from "./auth-utils";

export type SessionTokenVerifierErrorCode =
  | "INVALID_ALGORITHM"
  | "INVALID_SIGNATURE"
  | "TOKEN_EXPIRED"
  | "MALFORMED_TOKEN"
  | "UNKNOWN_KEY";

export interface SessionTokenVerifierError {
  code: SessionTokenVerifierErrorCode;
  message: string;
}

export interface SessionTokenVerificationSuccess<TPayload extends JwtPayload> {
  success: true;
  payload: TPayload;
  header: JwtHeader;
}

export interface SessionTokenVerificationFailure {
  success: false;
  error: SessionTokenVerifierError;
}

export type SessionTokenVerificationResult<TPayload extends JwtPayload> =
  | SessionTokenVerificationSuccess<TPayload>
  | SessionTokenVerificationFailure;

export interface SessionTokenVerifierConfig {
  publicKeys: Record<string, string>;
  keyId?: string;
}

export type SessionTokenVerifyOptions = Omit<VerifyOptions, "algorithms" | "complete">;

type SessionAccessTokenClaims = ISessionAccessTokenPayload & JwtPayload;
type SessionRefreshTokenClaims = ISessionRefreshTokenPayload & JwtPayload;

export interface ISessionTokenVerifier {
  verifyAccessToken: (
    encodedToken: string,
    verifyOptions?: SessionTokenVerifyOptions,
  ) => Promise<SessionTokenVerificationResult<SessionAccessTokenClaims>>;
  verifyRefreshToken: (
    encodedToken: string,
    verifyOptions?: SessionTokenVerifyOptions,
  ) => Promise<SessionTokenVerificationResult<SessionRefreshTokenClaims>>;
}

export class SessionTokenVerifier implements ISessionTokenVerifier {
  private readonly config: SessionTokenVerifierConfig;

  constructor(config: SessionTokenVerifierConfig) {
    this.config = config;
  }

  public verifyAccessToken(
    encodedToken: string,
    verifyOptions?: SessionTokenVerifyOptions,
  ): Promise<SessionTokenVerificationResult<SessionAccessTokenClaims>> {
    return this.verifyToken<SessionAccessTokenClaims>(
      encodedToken,
      (payload) => this.isAccessTokenClaims(payload),
      verifyOptions,
    );
  }

  public verifyRefreshToken(
    encodedToken: string,
    verifyOptions?: SessionTokenVerifyOptions,
  ): Promise<SessionTokenVerificationResult<SessionRefreshTokenClaims>> {
    return this.verifyToken<SessionRefreshTokenClaims>(
      encodedToken,
      (payload) => this.isRefreshTokenClaims(payload),
      verifyOptions,
    );
  }

  private async verifyToken<TPayload extends JwtPayload>(
    encodedToken: string,
    payloadValidator: (payload: JwtPayload) => payload is TPayload,
    verifyOptions?: SessionTokenVerifyOptions,
  ): Promise<SessionTokenVerificationResult<TPayload>> {
    const decodedToken = jwt.decode(encodedToken, { complete: true });

    if (!decodedToken || typeof decodedToken === "string" || !decodedToken.header) {
      return {
        success: false,
        error: {
          code: "MALFORMED_TOKEN",
          message: this.messageForErrorCode("MALFORMED_TOKEN"),
        },
      };
    }

    const publicKey = this.resolvePublicKey(decodedToken.header);

    if (!publicKey) {
      return {
        success: false,
        error: {
          code: "UNKNOWN_KEY",
          message: this.messageForErrorCode("UNKNOWN_KEY"),
        },
      };
    }

    const jwtOptions: VerifyOptions = {
      ...verifyOptions,
      algorithms: ["RS512"],
      complete: false,
    };

    try {
      const verifiedToken = jwt.verify(encodedToken, publicKey, jwtOptions);

      if (typeof verifiedToken === "string") {
        return {
          success: false,
          error: {
            code: "MALFORMED_TOKEN",
            message: this.messageForErrorCode("MALFORMED_TOKEN"),
          },
        };
      }

      if (!payloadValidator(verifiedToken)) {
        return {
          success: false,
          error: {
            code: "MALFORMED_TOKEN",
            message: this.messageForErrorCode("MALFORMED_TOKEN"),
          },
        };
      }

      return {
        success: true,
        payload: verifiedToken,
        header: decodedToken.header,
      };
    } catch (error) {
      return {
        success: false,
        error: this.mapVerificationError(error),
      };
    }
  }

  private resolvePublicKey(header: JwtHeader): string | undefined {
    const keyId = this.resolveKeyId(header);

    if (!keyId) {
      return undefined;
    }

    const publicKey = this.config.publicKeys[keyId];

    if (!publicKey) {
      return undefined;
    }

    return cleanupKey(publicKey) ?? publicKey;
  }

  private resolveKeyId(header: JwtHeader): string | undefined {
    // Key selection prefers the token's kid, then an explicitly configured default,
    // and finally the sole configured key when rotation is not in use.
    if (typeof header.kid === "string" && header.kid.length > 0) {
      return header.kid;
    }

    if (this.config.keyId) {
      return this.config.keyId;
    }

    const configuredKeyIds = Object.keys(this.config.publicKeys);

    if (configuredKeyIds.length === 1) {
      return configuredKeyIds[0];
    }

    return undefined;
  }

  private mapVerificationError(error: unknown): SessionTokenVerifierError {
    if (error instanceof TokenExpiredError) {
      return {
        code: "TOKEN_EXPIRED",
        message: this.messageForErrorCode("TOKEN_EXPIRED"),
      };
    }

    if (error instanceof JsonWebTokenError) {
      const errorCode = this.mapJsonWebTokenErrorCode((error as JsonWebTokenError).message);

      return {
        code: errorCode,
        message: this.messageForErrorCode(errorCode),
      };
    }

    return {
      code: "MALFORMED_TOKEN",
      message: this.messageForErrorCode("MALFORMED_TOKEN"),
    };
  }

  private mapJsonWebTokenErrorCode(message: string): SessionTokenVerifierErrorCode {
    const normalizedMessage = message.trim().toLowerCase();

    if (normalizedMessage.includes("invalid algorithm")) {
      return "INVALID_ALGORITHM";
    }

    if (normalizedMessage.includes("invalid signature")) {
      return "INVALID_SIGNATURE";
    }

    return "MALFORMED_TOKEN";
  }

  private isAccessTokenClaims(payload: JwtPayload): payload is SessionAccessTokenClaims {
    return (
      this.hasNonEmptyStringClaim(payload, "sessionId") &&
      this.hasNonEmptyStringClaim(payload, "sessionCreatedAt")
    );
  }

  private isRefreshTokenClaims(payload: JwtPayload): payload is SessionRefreshTokenClaims {
    return this.hasNonEmptyStringClaim(payload, "refreshTokenId");
  }

  private hasNonEmptyStringClaim(payload: JwtPayload, claim: string): boolean {
    const value = payload[claim];

    return typeof value === "string" && value.length > 0;
  }

  private messageForErrorCode(errorCode: SessionTokenVerifierErrorCode): string {
    switch (errorCode) {
      case "INVALID_ALGORITHM":
        return "Token uses an invalid algorithm";
      case "INVALID_SIGNATURE":
        return "Token signature is invalid";
      case "TOKEN_EXPIRED":
        return "Token has expired";
      case "UNKNOWN_KEY":
        return "No public key is configured for the token";
      case "MALFORMED_TOKEN":
      default:
        return "Token is malformed";
    }
  }
}
