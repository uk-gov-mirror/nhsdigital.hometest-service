import { type JwtHeader, type JwtPayload } from "jsonwebtoken";

import { type INhsTokenResponseModel } from "../models/nhs-login/nhs-login-token-response-model";
import { type INhsUserInfoResponseModel } from "../models/nhs-login/nhs-login-user-info-response-model";
import { type NhsLoginLoginClient, NhsLoginService } from "./nhs-login-service";
import {
  type INhsTokenVerifier,
  type NhsTokenVerificationResult,
  type NhsTokenVerifierErrorCode,
} from "./nhs-token-verifier";

function createUserInfo(
  overrides: Partial<INhsUserInfoResponseModel> = {},
): INhsUserInfoResponseModel {
  return {
    iss: "https://issuer.example",
    aud: "hometest",
    sub: "user-123",
    family_name: "MILLAR",
    given_name: "Mona",
    identity_proofing_level: "P9",
    email: "test.user@example.com",
    email_verified: "true",
    phone_number_verified: "true",
    birthdate: "1990-01-01",
    nhs_number: "9999999999",
    gp_registration_details: { gp_ods_code: "A12345" },
    ...overrides,
  };
}

function createTokenResponse(
  overrides: Partial<INhsTokenResponseModel> = {},
): INhsTokenResponseModel {
  return {
    access_token: "nhs-access-token",
    id_token: "nhs-id-token",
    refresh_token: "nhs-refresh-token",
    token_type: "Bearer",
    expires_in: "300",
    scope: "openid profile email phone",
    ...overrides,
  };
}

function verificationSuccess(sub: string): NhsTokenVerificationResult {
  return {
    success: true,
    payload: {
      sub,
      iss: "https://issuer.example",
      iat: 1234567890,
      exp: 1234571490,
    } as JwtPayload,
    header: { alg: "RS512", kid: "nhs-kid-1" } as JwtHeader,
  };
}

function verificationFailure(
  code: NhsTokenVerifierErrorCode,
  message: string,
): NhsTokenVerificationResult {
  return {
    success: false,
    error: { code, message },
  };
}

describe("NhsLoginService.executeCallback", () => {
  let nhsTokenVerifierMock: jest.Mocked<INhsTokenVerifier>;
  let nhsLoginClientMock: jest.Mocked<NhsLoginLoginClient>;

  beforeEach(() => {
    nhsTokenVerifierMock = {
      verifyToken: jest.fn(),
    };

    nhsLoginClientMock = {
      getUserTokens: jest.fn(),
      getUserInfo: jest.fn(),
    };
  });

  it("exchanges code, verifies tokens, calls userinfo, and returns callback result", async () => {
    const userInfo = createUserInfo();
    nhsLoginClientMock.getUserTokens.mockResolvedValue(createTokenResponse());
    nhsTokenVerifierMock.verifyToken
      .mockResolvedValueOnce(verificationSuccess("user-123"))
      .mockResolvedValueOnce(verificationSuccess("user-123"));
    nhsLoginClientMock.getUserInfo.mockResolvedValue(userInfo);

    const service = new NhsLoginService({
      nhsTokenVerifier: nhsTokenVerifierMock,
      nhsLoginClient: nhsLoginClientMock,
    });

    const result = await service.executeCallback("auth-code");

    expect(nhsLoginClientMock.getUserTokens).toHaveBeenCalledWith("auth-code");
    expect(nhsTokenVerifierMock.verifyToken).toHaveBeenNthCalledWith(1, "nhs-id-token");
    expect(nhsTokenVerifierMock.verifyToken).toHaveBeenNthCalledWith(2, "nhs-access-token");
    expect(nhsLoginClientMock.getUserInfo).toHaveBeenCalledWith("nhs-access-token");

    expect(result).toEqual({
      success: true,
      result: {
        userInfo,
        nhsAccessToken: "nhs-access-token",
        nhsRefreshToken: "nhs-refresh-token",
        idTokenSubject: "user-123",
      },
    });
  });

  it("returns TOKEN_EXCHANGE_FAILED when code exchange fails", async () => {
    nhsLoginClientMock.getUserTokens.mockRejectedValue(new Error("Token endpoint error"));

    const service = new NhsLoginService({
      nhsTokenVerifier: nhsTokenVerifierMock,
      nhsLoginClient: nhsLoginClientMock,
    });

    await expect(service.executeCallback("bad-code")).resolves.toEqual({
      success: false,
      error: {
        code: "TOKEN_EXCHANGE_FAILED",
        message: "Unable to exchange NHS authorization code",
      },
    });
    expect(nhsTokenVerifierMock.verifyToken).not.toHaveBeenCalled();
  });

  it("returns ID_TOKEN_VERIFICATION_FAILED when id_token verification fails", async () => {
    nhsLoginClientMock.getUserTokens.mockResolvedValue(createTokenResponse());
    nhsTokenVerifierMock.verifyToken.mockResolvedValueOnce(
      verificationFailure("INVALID_SIGNATURE", "Token signature is invalid"),
    );

    const service = new NhsLoginService({
      nhsTokenVerifier: nhsTokenVerifierMock,
      nhsLoginClient: nhsLoginClientMock,
    });

    await expect(service.executeCallback("auth-code")).resolves.toEqual({
      success: false,
      error: {
        code: "ID_TOKEN_VERIFICATION_FAILED",
        message: "Unable to verify NHS identity token",
      },
    });
    expect(nhsLoginClientMock.getUserInfo).not.toHaveBeenCalled();
  });

  it("returns ACCESS_TOKEN_VERIFICATION_FAILED when access_token verification fails", async () => {
    nhsLoginClientMock.getUserTokens.mockResolvedValue(createTokenResponse());
    nhsTokenVerifierMock.verifyToken
      .mockResolvedValueOnce(verificationSuccess("user-123"))
      .mockResolvedValueOnce(verificationFailure("TOKEN_EXPIRED", "Token has expired"));

    const service = new NhsLoginService({
      nhsTokenVerifier: nhsTokenVerifierMock,
      nhsLoginClient: nhsLoginClientMock,
    });

    await expect(service.executeCallback("auth-code")).resolves.toEqual({
      success: false,
      error: {
        code: "ACCESS_TOKEN_VERIFICATION_FAILED",
        message: "Unable to verify NHS access token",
      },
    });
    expect(nhsLoginClientMock.getUserInfo).not.toHaveBeenCalled();
  });

  it("returns ID_TOKEN_SUB_MISSING when id_token has no sub claim", async () => {
    nhsLoginClientMock.getUserTokens.mockResolvedValue(createTokenResponse());
    nhsTokenVerifierMock.verifyToken
      .mockResolvedValueOnce({
        success: true,
        payload: { iss: "https://issuer.example" } as JwtPayload,
        header: { alg: "RS512", kid: "nhs-kid-1" } as JwtHeader,
      })
      .mockResolvedValueOnce(verificationSuccess("user-123"));

    const service = new NhsLoginService({
      nhsTokenVerifier: nhsTokenVerifierMock,
      nhsLoginClient: nhsLoginClientMock,
    });

    await expect(service.executeCallback("auth-code")).resolves.toEqual({
      success: false,
      error: {
        code: "ID_TOKEN_SUB_MISSING",
        message: "NHS identity token is missing a required subject claim",
      },
    });
    expect(nhsLoginClientMock.getUserInfo).not.toHaveBeenCalled();
  });

  it("returns USER_INFO_FAILED when userinfo call fails", async () => {
    nhsLoginClientMock.getUserTokens.mockResolvedValue(createTokenResponse());
    nhsTokenVerifierMock.verifyToken
      .mockResolvedValueOnce(verificationSuccess("user-123"))
      .mockResolvedValueOnce(verificationSuccess("user-123"));
    nhsLoginClientMock.getUserInfo.mockRejectedValue(new Error("Userinfo endpoint error"));

    const service = new NhsLoginService({
      nhsTokenVerifier: nhsTokenVerifierMock,
      nhsLoginClient: nhsLoginClientMock,
    });

    await expect(service.executeCallback("auth-code")).resolves.toEqual({
      success: false,
      error: {
        code: "USER_INFO_FAILED",
        message: "Unable to retrieve NHS user information",
      },
    });
  });

  it("returns SUBJECT_MISMATCH when userinfo sub does not match id_token sub", async () => {
    nhsLoginClientMock.getUserTokens.mockResolvedValue(createTokenResponse());
    nhsTokenVerifierMock.verifyToken
      .mockResolvedValueOnce(verificationSuccess("id-token-user"))
      .mockResolvedValueOnce(verificationSuccess("id-token-user"));
    nhsLoginClientMock.getUserInfo.mockResolvedValue(createUserInfo({ sub: "different-user" }));

    const service = new NhsLoginService({
      nhsTokenVerifier: nhsTokenVerifierMock,
      nhsLoginClient: nhsLoginClientMock,
    });

    await expect(service.executeCallback("auth-code")).resolves.toEqual({
      success: false,
      error: {
        code: "SUBJECT_MISMATCH",
        message: "NHS user information does not match the verified identity token",
      },
    });
  });

  it.each([
    {
      name: "empty refresh_token",
      tokenResponse: createTokenResponse({ refresh_token: "" }),
    },
    {
      name: "whitespace-only refresh_token",
      tokenResponse: createTokenResponse({ refresh_token: "   \t  " }),
    },
    {
      name: "missing refresh_token",
      tokenResponse: {
        ...createTokenResponse(),
        refresh_token: undefined,
      } as unknown as INhsTokenResponseModel,
    },
  ])("treats $name as undefined", async ({ tokenResponse }) => {
    nhsLoginClientMock.getUserTokens.mockResolvedValue(tokenResponse);
    nhsTokenVerifierMock.verifyToken
      .mockResolvedValueOnce(verificationSuccess("user-123"))
      .mockResolvedValueOnce(verificationSuccess("user-123"));
    nhsLoginClientMock.getUserInfo.mockResolvedValue(createUserInfo());

    const service = new NhsLoginService({
      nhsTokenVerifier: nhsTokenVerifierMock,
      nhsLoginClient: nhsLoginClientMock,
    });

    const result = await service.executeCallback("auth-code");

    expect(result).toEqual({
      success: true,
      result: {
        userInfo: createUserInfo(),
        nhsAccessToken: "nhs-access-token",
        nhsRefreshToken: undefined,
        idTokenSubject: "user-123",
      },
    });
  });
});
