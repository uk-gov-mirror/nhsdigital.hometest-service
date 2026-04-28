import { type INhsLoginClient } from "../lib/login/nhs-login-client";
import { type ITokenService } from "../lib/login/token-service";
import { type INhsUserInfoResponseModel } from "../lib/models/nhs-login/nhs-login-user-info-response-model";
import { LoginService } from "./login-service";

function createUserInfo(
  overrides: Partial<INhsUserInfoResponseModel> = {},
): INhsUserInfoResponseModel {
  const defaults: INhsUserInfoResponseModel = {
    iss: "https://issuer.example",
    aud: "hometest",
    sub: "user-123",
    family_name: "MILLAR",
    given_name: "Mona",
    identity_proofing_level: "P9",
    email: "test.user@example.com",
    email_verified: "true",
    phone_number: "+447700900123",
    phone_number_verified: "true",
    birthdate: "1990-01-01",
    nhs_number: "9999999999",
    gp_registration_details: {
      gp_ods_code: "A12345",
    },
  };

  return {
    ...defaults,
    ...overrides,
  };
}

describe("LoginService.performLogin", () => {
  let tokenServiceMock: Pick<ITokenService, "verifyToken">;
  let nhsLoginClientMock: Pick<INhsLoginClient, "getUserTokens" | "getUserInfo">;

  beforeEach(() => {
    tokenServiceMock = {
      verifyToken: jest.fn(),
    };

    nhsLoginClientMock = {
      getUserTokens: jest.fn(),
      getUserInfo: jest.fn(),
    };
  });

  it("verifies token and returns user info from NhsLoginClient without additional transformation", async () => {
    const userInfoResponse = createUserInfo({ given_name: "Mona" });

    (nhsLoginClientMock.getUserTokens as jest.Mock).mockResolvedValue({
      access_token: "access-token",
      id_token: "id-token",
      refresh_token: "refresh-token",
      token_type: "Bearer",
      expires_in: "300",
      scope: "openid profile email phone",
    });

    (tokenServiceMock.verifyToken as jest.Mock)
      .mockResolvedValueOnce({ payload: { sub: "user-123" } })
      .mockResolvedValueOnce({ payload: {} });

    (nhsLoginClientMock.getUserInfo as jest.Mock).mockResolvedValue(userInfoResponse);

    const service = new LoginService({
      tokenService: tokenServiceMock as ITokenService,
      nhsLoginClient: nhsLoginClientMock as INhsLoginClient,
      sessionMaxDurationMinutes: 60,
    });

    const result = await service.performLogin({ code: "auth-code" });

    expect(nhsLoginClientMock.getUserTokens).toHaveBeenCalledWith("auth-code");
    expect(tokenServiceMock.verifyToken).toHaveBeenNthCalledWith(1, "id-token");
    expect(tokenServiceMock.verifyToken).toHaveBeenNthCalledWith(2, "access-token");
    expect(nhsLoginClientMock.getUserInfo).toHaveBeenCalledWith("access-token");

    expect(result).toEqual({
      userInfoResponse,
      nhsLoginAccessToken: "access-token",
      nhsLoginRefreshToken: "refresh-token",
    });
  });

  it("verifies token and returns whatever user info the client provides", async () => {
    const userInfoResponse = createUserInfo({ given_name: "Mona" });

    (nhsLoginClientMock.getUserTokens as jest.Mock).mockResolvedValue({
      access_token: "access-token",
      id_token: "id-token",
      refresh_token: "refresh-token",
      token_type: "Bearer",
      expires_in: "300",
      scope: "openid profile email phone",
    });

    (tokenServiceMock.verifyToken as jest.Mock)
      .mockResolvedValueOnce({ payload: { sub: "user-123" } })
      .mockResolvedValueOnce({ payload: {} });

    (nhsLoginClientMock.getUserInfo as jest.Mock).mockResolvedValue(userInfoResponse);

    const service = new LoginService({
      tokenService: tokenServiceMock as ITokenService,
      nhsLoginClient: nhsLoginClientMock as INhsLoginClient,
      sessionMaxDurationMinutes: 60,
    });

    const result = await service.performLogin({ code: "auth-code" });

    expect(result.userInfoResponse).toBe(userInfoResponse);
  });

  it("throws when user info sub does not match id token sub", async () => {
    (nhsLoginClientMock.getUserTokens as jest.Mock).mockResolvedValue({
      access_token: "access-token",
      id_token: "id-token",
      refresh_token: "refresh-token",
      token_type: "Bearer",
      expires_in: "300",
      scope: "openid profile email phone",
    });

    (tokenServiceMock.verifyToken as jest.Mock)
      .mockResolvedValueOnce({ payload: { sub: "id-token-user" } })
      .mockResolvedValueOnce({ payload: {} });

    (nhsLoginClientMock.getUserInfo as jest.Mock).mockResolvedValue(
      createUserInfo({ sub: "different-user" }),
    );

    const service = new LoginService({
      tokenService: tokenServiceMock as ITokenService,
      nhsLoginClient: nhsLoginClientMock as INhsLoginClient,
      sessionMaxDurationMinutes: 60,
    });

    await expect(service.performLogin({ code: "auth-code" })).rejects.toThrow(
      "The sub claim in the user info response does not match the sub claim in the id token",
    );
  });
});
