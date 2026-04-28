import type { APIGatewayProxyEvent } from "aws-lambda";

const mockInit = jest.fn();

jest.mock("./init", () => ({
  init: () => mockInit(),
}));

describe("session-login-lambda", () => {
  let consoleInfoSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    process.env.ALLOW_ORIGIN = "http://localhost:3000";
    mockInit.mockReset();
    consoleInfoSpy = jest.spyOn(console, "info").mockImplementation(() => undefined);
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("returns 400 when body is missing", async () => {
    mockInit.mockResolvedValue({
      sessionLoginService: {
        executeCallback: jest.fn(),
      },
      authCookieSameSite: "Lax",
      authCookieSecure: false,
    });

    const { lambdaHandler } = await import("./index");

    const response = await lambdaHandler({ body: null, headers: {} } as APIGatewayProxyEvent);

    expect(response.statusCode).toBe(400);
    expect(response.body).toContain("Body is required");
  });

  it("returns preview cookies on success without using legacy cookie names or paths", async () => {
    mockInit.mockResolvedValue({
      sessionLoginService: {
        executeCallback: jest.fn().mockResolvedValue({
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
              phoneNumberVerified: true,
              birthDate: "1990-01-01",
              nhsNumber: "9999999999",
              gpOdsCode: "A12345",
            },
            userInfoResponse: {
              iss: "https://userinfo.example",
              aud: "userinfo-audience",
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
              gp_registration_details: { gp_ods_code: "A12345" },
            },
            sessionId: "550e8400-e29b-41d4-a716-446655440000",
            refreshTokenId: "650e8400-e29b-41d4-a716-446655440000",
            sessionCreatedAt: "2026-04-27T10:15:30.000Z",
            signedAccessToken: "signed-preview-access",
            signedRefreshToken: "signed-preview-refresh",
          },
        }),
      },
      authCookieSameSite: "Lax",
      authCookieSecure: false,
    });

    const { lambdaHandler } = await import("./index");

    const response = await lambdaHandler({
      body: JSON.stringify({ code: "abc" }),
      headers: {
        "x-correlation-id": "550e8400-e29b-41d4-a716-446655440000",
      },
    } as unknown as APIGatewayProxyEvent);

    expect(response.statusCode).toBe(200);
    expect(response.headers?.["X-Correlation-ID"]).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(response.body).toBe(
      JSON.stringify({
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
          phoneNumberVerified: true,
          birthDate: "1990-01-01",
          nhsNumber: "9999999999",
          gpOdsCode: "A12345",
        },
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        refreshTokenId: "650e8400-e29b-41d4-a716-446655440000",
        sessionCreatedAt: "2026-04-27T10:15:30.000Z",
      }),
    );
    expect(response.multiValueHeaders?.["Set-Cookie"]).toEqual([
      "preview_auth=signed-preview-access; HttpOnly; Path=/session-preview; SameSite=Lax;",
      "preview_auth_refresh=signed-preview-refresh; HttpOnly; Path=/session-preview/refresh; SameSite=Lax;",
    ]);
  });

  it("includes Secure in preview cookies when configured", async () => {
    mockInit.mockResolvedValue({
      sessionLoginService: {
        executeCallback: jest.fn().mockResolvedValue({
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
              phoneNumberVerified: true,
              birthDate: "1990-01-01",
              nhsNumber: "9999999999",
              gpOdsCode: "A12345",
            },
            userInfoResponse: {
              iss: "https://userinfo.example",
              aud: "userinfo-audience",
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
              gp_registration_details: { gp_ods_code: "A12345" },
            },
            sessionId: "550e8400-e29b-41d4-a716-446655440000",
            refreshTokenId: "650e8400-e29b-41d4-a716-446655440000",
            sessionCreatedAt: "2026-04-27T10:15:30.000Z",
            signedAccessToken: "signed-preview-access",
            signedRefreshToken: "signed-preview-refresh",
          },
        }),
      },
      authCookieSameSite: "None",
      authCookieSecure: true,
    });

    const { lambdaHandler } = await import("./index");

    const response = await lambdaHandler({
      body: JSON.stringify({ code: "abc" }),
      headers: {
        "x-correlation-id": "550e8400-e29b-41d4-a716-446655440000",
      },
    } as unknown as APIGatewayProxyEvent);

    expect(response.multiValueHeaders?.["Set-Cookie"]).toEqual([
      "preview_auth=signed-preview-access; HttpOnly; Path=/session-preview; SameSite=None; Secure;",
      "preview_auth_refresh=signed-preview-refresh; HttpOnly; Path=/session-preview/refresh; SameSite=None; Secure;",
    ]);
  });

  it("returns 401 for preview authentication failures", async () => {
    mockInit.mockResolvedValue({
      sessionLoginService: {
        executeCallback: jest.fn().mockResolvedValue({
          success: false,
          error: {
            code: "ID_TOKEN_VERIFICATION_FAILED",
            message: "Unable to verify NHS identity token",
          },
        }),
      },
      authCookieSameSite: "Lax",
      authCookieSecure: false,
    });

    const { lambdaHandler } = await import("./index");

    const response = await lambdaHandler({
      body: JSON.stringify({ code: "abc" }),
      headers: {
        "x-correlation-id": "550e8400-e29b-41d4-a716-446655440000",
      },
    } as unknown as APIGatewayProxyEvent);

    expect(response.statusCode).toBe(401);
    expect(response.body).toBe(JSON.stringify({ message: "Unable to verify NHS identity token" }));
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "session-login-lambda",
      "Preview session login failed",
      {
        correlationId: "550e8400-e29b-41d4-a716-446655440000",
        code: "ID_TOKEN_VERIFICATION_FAILED",
        statusCode: 401,
      },
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("returns 502 for upstream NHS exchange failures", async () => {
    mockInit.mockResolvedValue({
      sessionLoginService: {
        executeCallback: jest.fn().mockResolvedValue({
          success: false,
          error: {
            code: "TOKEN_EXCHANGE_FAILED",
            message: "Unable to exchange NHS authorization code",
          },
        }),
      },
      authCookieSameSite: "Lax",
      authCookieSecure: false,
    });

    const { lambdaHandler } = await import("./index");

    const response = await lambdaHandler({
      body: JSON.stringify({ code: "abc" }),
      headers: {
        "x-correlation-id": "550e8400-e29b-41d4-a716-446655440000",
      },
    } as unknown as APIGatewayProxyEvent);

    expect(response.statusCode).toBe(502);
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "session-login-lambda",
      "Preview session login failed",
      {
        correlationId: "550e8400-e29b-41d4-a716-446655440000",
        code: "TOKEN_EXCHANGE_FAILED",
        statusCode: 502,
      },
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
