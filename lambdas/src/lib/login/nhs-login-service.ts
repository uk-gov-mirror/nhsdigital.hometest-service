import { type INhsTokenResponseModel } from "../models/nhs-login/nhs-login-token-response-model";
import { type INhsUserInfoResponseModel } from "../models/nhs-login/nhs-login-user-info-response-model";
import { type INhsLoginClient } from "./nhs-login-client";
import { type INhsTokenVerifier } from "./nhs-token-verifier";

export interface INhsLoginResult {
  userInfo: INhsUserInfoResponseModel;
  nhsAccessToken: string;
  nhsRefreshToken?: string;
  idTokenSubject: string;
}

export type NhsLoginErrorCode =
  | "TOKEN_EXCHANGE_FAILED"
  | "ID_TOKEN_VERIFICATION_FAILED"
  | "ACCESS_TOKEN_VERIFICATION_FAILED"
  | "ID_TOKEN_SUB_MISSING"
  | "USER_INFO_FAILED"
  | "SUBJECT_MISMATCH";

export interface NhsLoginError {
  code: NhsLoginErrorCode;
  message: string;
}

export interface NhsLoginSuccess {
  success: true;
  result: INhsLoginResult;
}

export interface NhsLoginFailure {
  success: false;
  error: NhsLoginError;
}

export type NhsLoginExecutionResult = NhsLoginSuccess | NhsLoginFailure;

export interface INhsLoginService {
  executeCallback: (code: string) => Promise<NhsLoginExecutionResult>;
}

export type NhsLoginLoginClient = Pick<INhsLoginClient, "getUserTokens" | "getUserInfo">;

export interface NhsLoginServiceParams {
  nhsTokenVerifier: INhsTokenVerifier;
  nhsLoginClient: NhsLoginLoginClient;
}

export class NhsLoginService implements INhsLoginService {
  private readonly nhsTokenVerifier: INhsTokenVerifier;
  private readonly nhsLoginClient: NhsLoginLoginClient;

  constructor(params: NhsLoginServiceParams) {
    this.nhsTokenVerifier = params.nhsTokenVerifier;
    this.nhsLoginClient = params.nhsLoginClient;
  }

  public async executeCallback(code: string): Promise<NhsLoginExecutionResult> {
    let tokenResponse: INhsTokenResponseModel;

    try {
      tokenResponse = await this.nhsLoginClient.getUserTokens(code);
    } catch {
      return this.failure("TOKEN_EXCHANGE_FAILED", "Unable to exchange NHS authorization code");
    }

    const idTokenResult = await this.nhsTokenVerifier.verifyToken(tokenResponse.id_token);

    if (!idTokenResult.success) {
      return this.failure("ID_TOKEN_VERIFICATION_FAILED", "Unable to verify NHS identity token");
    }

    const accessTokenResult = await this.nhsTokenVerifier.verifyToken(tokenResponse.access_token);

    if (!accessTokenResult.success) {
      return this.failure("ACCESS_TOKEN_VERIFICATION_FAILED", "Unable to verify NHS access token");
    }

    const idTokenSubject = idTokenResult.payload.sub;

    if (!idTokenSubject) {
      return this.failure(
        "ID_TOKEN_SUB_MISSING",
        "NHS identity token is missing a required subject claim",
      );
    }

    let userInfo: INhsUserInfoResponseModel;

    try {
      userInfo = await this.nhsLoginClient.getUserInfo(tokenResponse.access_token);
    } catch {
      return this.failure("USER_INFO_FAILED", "Unable to retrieve NHS user information");
    }

    if (userInfo.sub !== idTokenSubject) {
      return this.failure(
        "SUBJECT_MISMATCH",
        "NHS user information does not match the verified identity token",
      );
    }

    return {
      success: true,
      result: {
        userInfo,
        nhsAccessToken: tokenResponse.access_token,
        nhsRefreshToken: this.normalizeRefreshToken(tokenResponse.refresh_token),
        idTokenSubject,
      },
    };
  }

  private failure(code: NhsLoginErrorCode, message: string): NhsLoginFailure {
    return {
      success: false,
      error: {
        code,
        message,
      },
    };
  }

  private normalizeRefreshToken(refreshToken: string | undefined): string | undefined {
    const trimmedRefreshToken = refreshToken?.trim();
    return trimmedRefreshToken && trimmedRefreshToken.length > 0 ? trimmedRefreshToken : undefined;
  }
}
