import { type ISessionTokenService } from "../lib/auth/session-token-service";
import { type SessionDbClient } from "../lib/db/session-db-client";
import {
  type INhsLoginService,
  type NhsLoginExecutionResult,
} from "../lib/login/nhs-login-service";
import { SessionLoginService } from "./session-login-service";

function createNhsLoginSuccess(
  overrides: Partial<Extract<NhsLoginExecutionResult, { success: true }>["result"]> = {},
): Extract<NhsLoginExecutionResult, { success: true }> {
  return {
    success: true,
    result: {
      userInfo: {
        iss: "https://userinfo.example",
        aud: "userinfo-audience",
        sub: "user-123",
        family_name: "MILLAR",
        given_name: "Mona",
        identity_proofing_level: "P9",
        email: "test.user@example.com",
        email_verified: "true",
        phone_number: "+447700900123",
        phone_number_verified: "false",
        birthdate: "1990-01-01",
        nhs_number: "9999999999",
        gp_registration_details: {
          gp_ods_code: "A12345",
        },
      },
      nhsAccessToken: "nhs-access-token",
      nhsRefreshToken: "nhs-refresh-token",
      idTokenSubject: "user-123",
      idTokenIssuer: "https://id-token.example",
      idTokenAudience: "client-id-123",
      ...overrides,
    },
  };
}

describe("SessionLoginService.executeCallback", () => {
  let nhsLoginServiceMock: jest.Mocked<INhsLoginService>;
  let sessionDbClientMock: jest.Mocked<Pick<SessionDbClient, "createSession">>;
  let sessionTokenServiceMock: jest.Mocked<ISessionTokenService>;
  let uuidGeneratorMock: jest.Mock;
  const fixedNow = new Date("2026-04-27T10:15:30.000Z");

  beforeEach(() => {
    nhsLoginServiceMock = {
      executeCallback: jest.fn(),
    };

    sessionDbClientMock = {
      createSession: jest.fn(),
    };

    sessionTokenServiceMock = {
      signAccessToken: jest.fn().mockReturnValue("signed-preview-access"),
      signRefreshToken: jest.fn().mockReturnValue("signed-preview-refresh"),
    };

    uuidGeneratorMock = jest
      .fn()
      .mockReturnValueOnce("550e8400-e29b-41d4-a716-446655440000")
      .mockReturnValueOnce("650e8400-e29b-41d4-a716-446655440000");
  });

  it("creates a preview session and signs session tokens with isolated claims", async () => {
    nhsLoginServiceMock.executeCallback.mockResolvedValue(createNhsLoginSuccess());
    sessionDbClientMock.createSession.mockResolvedValue({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      refreshTokenId: "650e8400-e29b-41d4-a716-446655440000",
      nhsAccessToken: "nhs-access-token",
      userInfo: {
        issuer: "https://id-token.example",
        audience: "client-id-123",
        subject: "user-123",
        familyName: "MILLAR",
        givenName: "Mona",
        identityProofingLevel: "P9",
        email: "test.user@example.com",
        emailVerified: true,
        phoneNumber: "+447700900123",
        phoneNumberVerified: false,
        birthDate: "1990-01-01",
        nhsNumber: "9999999999",
        gpOdsCode: "A12345",
      },
      sessionCreatedAt: fixedNow.toISOString(),
      lastRefreshAt: fixedNow.toISOString(),
      maxExpiresAt: "2026-04-27T11:15:30.000Z",
    });

    const service = new SessionLoginService({
      nhsLoginService: nhsLoginServiceMock,
      sessionDbClient: sessionDbClientMock,
      sessionTokenService: sessionTokenServiceMock,
      sessionMaxDurationMinutes: 60,
      nhsLoginClientId: "client-id-123",
      uuidGenerator: uuidGeneratorMock,
      clock: () => fixedNow,
    });

    const result = await service.executeCallback("auth-code");

    expect(sessionDbClientMock.createSession).toHaveBeenCalledWith({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      refreshTokenId: "650e8400-e29b-41d4-a716-446655440000",
      nhsAccessToken: "nhs-access-token",
      userInfo: {
        issuer: "https://id-token.example",
        audience: "client-id-123",
        subject: "user-123",
        familyName: "MILLAR",
        givenName: "Mona",
        identityProofingLevel: "P9",
        email: "test.user@example.com",
        emailVerified: true,
        phoneNumber: "+447700900123",
        phoneNumberVerified: false,
        birthDate: "1990-01-01",
        nhsNumber: "9999999999",
        gpOdsCode: "A12345",
      },
      sessionCreatedAt: fixedNow.toISOString(),
      lastRefreshAt: fixedNow.toISOString(),
      maxExpiresAt: "2026-04-27T11:15:30.000Z",
    });
    expect(sessionTokenServiceMock.signAccessToken).toHaveBeenCalledWith({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      sessionCreatedAt: fixedNow.toISOString(),
    });
    expect(sessionTokenServiceMock.signRefreshToken).toHaveBeenCalledWith({
      refreshTokenId: "650e8400-e29b-41d4-a716-446655440000",
    });
    expect(result).toEqual({
      success: true,
      result: {
        userInfo: {
          issuer: "https://id-token.example",
          audience: "client-id-123",
          subject: "user-123",
          familyName: "MILLAR",
          givenName: "Mona",
          identityProofingLevel: "P9",
          email: "test.user@example.com",
          emailVerified: true,
          phoneNumber: "+447700900123",
          phoneNumberVerified: false,
          birthDate: "1990-01-01",
          nhsNumber: "9999999999",
          gpOdsCode: "A12345",
        },
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        refreshTokenId: "650e8400-e29b-41d4-a716-446655440000",
        sessionCreatedAt: fixedNow.toISOString(),
        signedAccessToken: "signed-preview-access",
        signedRefreshToken: "signed-preview-refresh",
      },
    });
  });

  it("passes through NHS login failures", async () => {
    nhsLoginServiceMock.executeCallback.mockResolvedValue({
      success: false,
      error: {
        code: "TOKEN_EXCHANGE_FAILED",
        message: "Unable to exchange NHS authorization code",
      },
    });

    const service = new SessionLoginService({
      nhsLoginService: nhsLoginServiceMock,
      sessionDbClient: sessionDbClientMock,
      sessionTokenService: sessionTokenServiceMock,
      sessionMaxDurationMinutes: 60,
      nhsLoginClientId: "client-id-123",
    });

    await expect(service.executeCallback("bad-code")).resolves.toEqual({
      success: false,
      error: {
        code: "TOKEN_EXCHANGE_FAILED",
        message: "Unable to exchange NHS authorization code",
      },
    });
    expect(sessionDbClientMock.createSession).not.toHaveBeenCalled();
  });

  it("fails when the verified ID token issuer is missing", async () => {
    nhsLoginServiceMock.executeCallback.mockResolvedValue(
      createNhsLoginSuccess({ idTokenIssuer: "  " }),
    );

    const service = new SessionLoginService({
      nhsLoginService: nhsLoginServiceMock,
      sessionDbClient: sessionDbClientMock,
      sessionTokenService: sessionTokenServiceMock,
      sessionMaxDurationMinutes: 60,
      nhsLoginClientId: "client-id-123",
    });

    await expect(service.executeCallback("auth-code")).resolves.toEqual({
      success: false,
      error: {
        code: "ID_TOKEN_ISS_MISSING",
        message: "NHS identity token is missing a required issuer claim",
      },
    });
  });

  it("accepts an array-form audience when it includes the configured client ID", async () => {
    nhsLoginServiceMock.executeCallback.mockResolvedValue(
      createNhsLoginSuccess({ idTokenAudience: ["other-audience", "client-id-123"] }),
    );

    sessionDbClientMock.createSession.mockResolvedValue({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      refreshTokenId: "650e8400-e29b-41d4-a716-446655440000",
      nhsAccessToken: "nhs-access-token",
      userInfo: {
        issuer: "https://id-token.example",
        audience: "client-id-123",
        subject: "user-123",
        familyName: "MILLAR",
        givenName: "Mona",
        identityProofingLevel: "P9",
        email: "test.user@example.com",
        emailVerified: true,
        phoneNumber: "+447700900123",
        phoneNumberVerified: false,
        birthDate: "1990-01-01",
        nhsNumber: "9999999999",
        gpOdsCode: "A12345",
      },
      sessionCreatedAt: fixedNow.toISOString(),
      lastRefreshAt: fixedNow.toISOString(),
      maxExpiresAt: "2026-04-27T11:15:30.000Z",
    });

    const service = new SessionLoginService({
      nhsLoginService: nhsLoginServiceMock,
      sessionDbClient: sessionDbClientMock,
      sessionTokenService: sessionTokenServiceMock,
      sessionMaxDurationMinutes: 60,
      nhsLoginClientId: "client-id-123",
      uuidGenerator: uuidGeneratorMock,
      clock: () => fixedNow,
    });

    await expect(service.executeCallback("auth-code")).resolves.toMatchObject({
      success: true,
      result: {
        userInfo: {
          audience: "client-id-123",
        },
      },
    });
  });

  it("fails when the verified ID token audience does not include the configured client ID", async () => {
    nhsLoginServiceMock.executeCallback.mockResolvedValue(
      createNhsLoginSuccess({ idTokenAudience: ["other-audience"] }),
    );

    const service = new SessionLoginService({
      nhsLoginService: nhsLoginServiceMock,
      sessionDbClient: sessionDbClientMock,
      sessionTokenService: sessionTokenServiceMock,
      sessionMaxDurationMinutes: 60,
      nhsLoginClientId: "client-id-123",
    });

    await expect(service.executeCallback("auth-code")).resolves.toEqual({
      success: false,
      error: {
        code: "ID_TOKEN_AUD_INVALID",
        message: "NHS identity token has an invalid audience claim",
      },
    });
  });

  it("fails when the NHS number does not satisfy the session schema constraint", async () => {
    nhsLoginServiceMock.executeCallback.mockResolvedValue(
      createNhsLoginSuccess({
        userInfo: {
          ...createNhsLoginSuccess().result.userInfo,
          nhs_number: "ABC",
        },
      }),
    );

    const service = new SessionLoginService({
      nhsLoginService: nhsLoginServiceMock,
      sessionDbClient: sessionDbClientMock,
      sessionTokenService: sessionTokenServiceMock,
      sessionMaxDurationMinutes: 60,
      nhsLoginClientId: "client-id-123",
    });

    await expect(service.executeCallback("auth-code")).resolves.toEqual({
      success: false,
      error: {
        code: "SESSION_DATA_INVALID",
        message: "NHS user information is missing required session fields",
      },
    });
  });

  it("fails gracefully when a scalar user info claim is missing", async () => {
    nhsLoginServiceMock.executeCallback.mockResolvedValue(
      createNhsLoginSuccess({
        userInfo: {
          ...createNhsLoginSuccess().result.userInfo,
          phone_number: undefined as unknown as string,
        },
      }),
    );

    const service = new SessionLoginService({
      nhsLoginService: nhsLoginServiceMock,
      sessionDbClient: sessionDbClientMock,
      sessionTokenService: sessionTokenServiceMock,
      sessionMaxDurationMinutes: 60,
      nhsLoginClientId: "client-id-123",
    });

    await expect(service.executeCallback("auth-code")).resolves.toEqual({
      success: false,
      error: {
        code: "SESSION_DATA_INVALID",
        message: "NHS user information is missing required session fields",
      },
    });
  });

  it("fails gracefully when a nested user info claim is missing", async () => {
    nhsLoginServiceMock.executeCallback.mockResolvedValue(
      createNhsLoginSuccess({
        userInfo: {
          ...createNhsLoginSuccess().result.userInfo,
          gp_registration_details: undefined as unknown as { gp_ods_code: string },
        },
      }),
    );

    const service = new SessionLoginService({
      nhsLoginService: nhsLoginServiceMock,
      sessionDbClient: sessionDbClientMock,
      sessionTokenService: sessionTokenServiceMock,
      sessionMaxDurationMinutes: 60,
      nhsLoginClientId: "client-id-123",
    });

    await expect(service.executeCallback("auth-code")).resolves.toEqual({
      success: false,
      error: {
        code: "SESSION_DATA_INVALID",
        message: "NHS user information is missing required session fields",
      },
    });
  });

  it("returns SESSION_PERSIST_FAILED when Aurora persistence fails", async () => {
    nhsLoginServiceMock.executeCallback.mockResolvedValue(createNhsLoginSuccess());
    sessionDbClientMock.createSession.mockRejectedValue(new Error("db down"));

    const service = new SessionLoginService({
      nhsLoginService: nhsLoginServiceMock,
      sessionDbClient: sessionDbClientMock,
      sessionTokenService: sessionTokenServiceMock,
      sessionMaxDurationMinutes: 60,
      nhsLoginClientId: "client-id-123",
      uuidGenerator: uuidGeneratorMock,
      clock: () => fixedNow,
    });

    await expect(service.executeCallback("auth-code")).resolves.toEqual({
      success: false,
      error: {
        code: "SESSION_PERSIST_FAILED",
        message: "Unable to create a preview session after successful NHS Login authentication",
      },
    });
  });
});
