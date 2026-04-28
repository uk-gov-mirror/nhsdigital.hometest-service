import jwt, {
  JsonWebTokenError,
  type JwtHeader,
  type JwtPayload,
  TokenExpiredError,
  type VerifyOptions,
} from "jsonwebtoken";

export interface NhsJwksKeyProvider {
  fetchPublicKeyById: (kid: string) => Promise<string | undefined>;
}

export interface NhsTokenVerifierConfig {
  keyProvider: NhsJwksKeyProvider;
  issuer: string;
}

export type NhsTokenVerifierErrorCode =
  | "DECODE_FAILURE"
  | "MISSING_KID"
  | "KEY_RESOLUTION_FAILED"
  | "INVALID_SIGNATURE"
  | "TOKEN_EXPIRED"
  | "INVALID_ISSUER"
  | "VERIFICATION_FAILED";

export interface NhsTokenVerifierError {
  code: NhsTokenVerifierErrorCode;
  message: string;
}

export interface NhsTokenVerificationSuccess {
  success: true;
  payload: JwtPayload;
  header: JwtHeader;
}

export interface NhsTokenVerificationFailure {
  success: false;
  error: NhsTokenVerifierError;
}

export type NhsTokenVerificationResult = NhsTokenVerificationSuccess | NhsTokenVerificationFailure;

export interface INhsTokenVerifier {
  verifyToken: (encodedToken: string) => Promise<NhsTokenVerificationResult>;
}

export class NhsTokenVerifier implements INhsTokenVerifier {
  private readonly config: NhsTokenVerifierConfig;

  constructor(config: NhsTokenVerifierConfig) {
    this.config = config;
  }

  public async verifyToken(encodedToken: string): Promise<NhsTokenVerificationResult> {
    const decodedToken = jwt.decode(encodedToken, { complete: true });

    if (!decodedToken || typeof decodedToken === "string" || !decodedToken.header) {
      return {
        success: false,
        error: { code: "DECODE_FAILURE", message: "Token could not be decoded" },
      };
    }

    const kid = decodedToken.header.kid;

    if (typeof kid !== "string" || kid.length === 0) {
      return {
        success: false,
        error: { code: "MISSING_KID", message: "kid is not present in the token header" },
      };
    }

    let publicKey: string | undefined;

    try {
      publicKey = await this.config.keyProvider.fetchPublicKeyById(kid);
    } catch {
      return {
        success: false,
        error: {
          code: "KEY_RESOLUTION_FAILED",
          message: "Failed to resolve public key for the token",
        },
      };
    }

    if (!publicKey) {
      return {
        success: false,
        error: {
          code: "KEY_RESOLUTION_FAILED",
          message: "No public key was returned for the token",
        },
      };
    }

    const verifyOptions: VerifyOptions = {
      algorithms: ["RS512"],
      issuer: this.config.issuer,
      complete: false,
    };

    try {
      const verifiedPayload = jwt.verify(encodedToken, publicKey, verifyOptions);

      if (typeof verifiedPayload === "string") {
        return {
          success: false,
          error: {
            code: "VERIFICATION_FAILED",
            message: "Token verification returned unexpected format",
          },
        };
      }

      return {
        success: true,
        payload: verifiedPayload,
        header: decodedToken.header,
      };
    } catch (error) {
      return {
        success: false,
        error: this.mapVerificationError(error),
      };
    }
  }

  private mapVerificationError(error: unknown): NhsTokenVerifierError {
    if (error instanceof TokenExpiredError) {
      return { code: "TOKEN_EXPIRED", message: "Token has expired" };
    }

    if (error instanceof JsonWebTokenError) {
      const normalizedMessage = (error as { message?: string }).message?.trim().toLowerCase() ?? "";

      if (normalizedMessage.includes("invalid signature")) {
        return { code: "INVALID_SIGNATURE", message: "Token signature is invalid" };
      }

      if (normalizedMessage.includes("jwt issuer invalid")) {
        return {
          code: "INVALID_ISSUER",
          message: "Token issuer does not match expected issuer",
        };
      }

      return {
        code: "VERIFICATION_FAILED",
        message: "Token verification failed",
      };
    }

    return { code: "VERIFICATION_FAILED", message: "Token verification failed" };
  }
}
