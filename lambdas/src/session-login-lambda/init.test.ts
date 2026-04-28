import type { buildEnvironment } from "./init";

export type SessionLoginBuildEnvironmentFn = typeof buildEnvironment;

const mockSessionLoginRetrieveMandatoryEnvVariable = jest.fn();
const mockSessionLoginRetrieveOptionalEnvVariable = jest.fn();
const mockSessionLoginRetrieveOptionalEnvVariableWithDefault = jest.fn();
const mockSessionLoginGetSecretValue = jest.fn();
const mockSessionLoginPostgresConfigFromEnv = jest.fn();

const mockSessionLoginClientInstance = {
  exchangeAuthCodeForTokens: jest.fn(),
  getUserInfo: jest.fn(),
  fetchPublicKeyById: jest.fn(),
};
const mockSessionLoginTokenVerifierInstance = { verifyToken: jest.fn() };
const mockNhsLoginServiceInstance = { executeCallback: jest.fn() };
const mockSessionDbClientInstance = { createSession: jest.fn() };
const mockSessionTokenServiceInstance = {
  signAccessToken: jest.fn(),
  signRefreshToken: jest.fn(),
};
const mockSessionLoginServiceInstance = { executeCallback: jest.fn() };

jest.mock("../lib/utils/utils", () => ({
  retrieveMandatoryEnvVariable: (...args: unknown[]) =>
    mockSessionLoginRetrieveMandatoryEnvVariable(...args),
  retrieveOptionalEnvVariable: (...args: unknown[]) =>
    mockSessionLoginRetrieveOptionalEnvVariable(...args),
  retrieveOptionalEnvVariableWithDefault: (...args: unknown[]) =>
    mockSessionLoginRetrieveOptionalEnvVariableWithDefault(...args),
}));

jest.mock("../lib/secrets/secrets-manager-client", () => ({
  AwsSecretsClient: jest.fn().mockImplementation(() => ({
    getSecretValue: mockSessionLoginGetSecretValue,
  })),
}));

jest.mock("../lib/db/db-config", () => ({
  postgresConfigFromEnv: (...args: unknown[]) => mockSessionLoginPostgresConfigFromEnv(...args),
}));

jest.mock("../lib/db/db-client", () => ({
  PostgresDbClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../lib/db/session-db-client", () => ({
  SessionDbClient: jest.fn().mockImplementation(() => mockSessionDbClientInstance),
}));

jest.mock("../lib/http/http-client", () => ({
  FetchHttpClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../lib/login/nhs-login-jwt-helper", () => ({
  NhsLoginJwtHelper: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../lib/login/nhs-login-client", () => ({
  NhsLoginClient: jest.fn().mockImplementation(() => mockSessionLoginClientInstance),
}));

jest.mock("../lib/login/nhs-token-verifier", () => ({
  NhsTokenVerifier: jest.fn().mockImplementation(() => mockSessionLoginTokenVerifierInstance),
}));

jest.mock("../lib/login/nhs-login-service", () => ({
  NhsLoginService: jest.fn().mockImplementation(() => mockNhsLoginServiceInstance),
}));

jest.mock("../lib/auth/session-token-service", () => ({
  SessionTokenService: jest.fn().mockImplementation(() => mockSessionTokenServiceInstance),
}));

jest.mock("./session-login-service", () => ({
  SessionLoginService: jest.fn().mockImplementation(() => mockSessionLoginServiceInstance),
}));

jest.mock("jwks-rsa", () => ({
  JwksClient: jest.fn().mockImplementation(() => ({})),
}));

describe("session-login-lambda init", () => {
  const baseEnvValues: Record<string, string> = {
    AWS_REGION: "eu-west-2",
    NHS_LOGIN_BASE_ENDPOINT_URL: "https://nhs-login.example",
    NHS_LOGIN_CLIENT_ID: "hometest-preview",
    NHS_LOGIN_REDIRECT_URL: "https://preview.example/session-preview/login",
    NHS_LOGIN_PRIVATE_KEY_SECRET_NAME: "nhs-login-private-key",
    AUTH_COOKIE_PRIVATE_KEYS_SECRET_NAME: "preview-cookie-private-key",
    AUTH_SESSION_MAX_DURATION_MINUTES: "60",
    AUTH_ACCESS_TOKEN_EXPIRY_DURATION_MINUTES: "15",
    AUTH_REFRESH_TOKEN_EXPIRY_DURATION_MINUTES: "120",
    AUTH_COOKIE_SAME_SITE: "Lax",
  };

  const mockSessionLoginPostgresConfig = {
    user: "test-user",
    host: "test-host",
    port: 5432,
    database: "test-db",
    password: jest.fn().mockResolvedValue("test-password"),
  };

  function setEnvVariableMocks(overrides: Record<string, string> = {}): void {
    const values = { ...baseEnvValues, ...overrides };

    mockSessionLoginRetrieveMandatoryEnvVariable.mockImplementation((key: string) => {
      const value = values[key];
      if (!value) {
        throw new Error(`Missing environment variable: ${key}`);
      }
      return value;
    });
    mockSessionLoginRetrieveOptionalEnvVariable.mockImplementation((key: string) => values[key]);
    mockSessionLoginRetrieveOptionalEnvVariableWithDefault.mockImplementation(
      (key: string, defaultValue: string) => values[key] ?? defaultValue,
    );
  }

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    setEnvVariableMocks();
    mockSessionLoginGetSecretValue
      .mockResolvedValueOnce("test-nhs-login-private-key")
      .mockResolvedValueOnce(JSON.stringify({ key: "test-preview-cookie-private-key" }));
    mockSessionLoginPostgresConfigFromEnv.mockReturnValue(mockSessionLoginPostgresConfig);
  });

  it("initializes and wires isolated preview dependencies with expected configuration", async () => {
    const { buildEnvironment: init } = await import("./init");
    const result = await init();

    const { AwsSecretsClient } = await import("../lib/secrets/secrets-manager-client");
    const { NhsLoginClient } = await import("../lib/login/nhs-login-client");
    const { NhsTokenVerifier } = await import("../lib/login/nhs-token-verifier");
    const { NhsLoginService } = await import("../lib/login/nhs-login-service");
    const { SessionTokenService } = await import("../lib/auth/session-token-service");
    const { SessionLoginService } = await import("./session-login-service");

    expect(AwsSecretsClient).toHaveBeenCalledWith("eu-west-2");
    expect(mockSessionLoginGetSecretValue).toHaveBeenNthCalledWith(1, "nhs-login-private-key");
    expect(mockSessionLoginGetSecretValue).toHaveBeenNthCalledWith(2, "preview-cookie-private-key");
    expect(mockSessionLoginPostgresConfigFromEnv).toHaveBeenCalledWith(expect.any(Object));
    expect(NhsLoginClient).toHaveBeenCalledTimes(1);
    expect(NhsTokenVerifier).toHaveBeenCalledWith({
      keyProvider: mockSessionLoginClientInstance,
      issuer: "https://nhs-login.example",
    });
    expect(NhsLoginService).toHaveBeenCalledWith({
      nhsTokenVerifier: mockSessionLoginTokenVerifierInstance,
      nhsLoginClient: mockSessionLoginClientInstance,
    });
    expect(SessionTokenService).toHaveBeenCalledWith({
      privateKey: "test-preview-cookie-private-key",
      accessTokenExpiryDurationMinutes: 15,
      refreshTokenExpiryDurationMinutes: 120,
    });
    expect(SessionLoginService).toHaveBeenCalledWith({
      nhsLoginService: mockNhsLoginServiceInstance,
      sessionDbClient: mockSessionDbClientInstance,
      sessionTokenService: mockSessionTokenServiceInstance,
      sessionMaxDurationMinutes: 60,
      nhsLoginClientId: "hometest-preview",
    });
    expect(result).toEqual({
      sessionLoginService: mockSessionLoginServiceInstance,
      authCookieSameSite: "Lax",
      authCookieSecure: true,
    });
  });

  it("uses the configured JWKS URI when present", async () => {
    setEnvVariableMocks({ NHS_LOGIN_JWKS_URI: "https://nhs-login.example/custom-jwks" });

    const { buildEnvironment: init } = await import("./init");
    await init();

    const { JwksClient } = await import("jwks-rsa");
    expect(JwksClient).toHaveBeenCalledWith({
      cache: true,
      rateLimit: true,
      jwksUri: "https://nhs-login.example/custom-jwks",
    });
  });

  it("throws when a required environment variable is missing", async () => {
    setEnvVariableMocks({ AWS_REGION: "" });

    const { buildEnvironment: init } = await import("./init");
    await expect(init()).rejects.toThrow("Missing environment variable: AWS_REGION");
  });

  it("throws when a duration is not a positive integer", async () => {
    setEnvVariableMocks({ AUTH_SESSION_MAX_DURATION_MINUTES: "0" });

    const { buildEnvironment: init } = await import("./init");
    await expect(init()).rejects.toThrow(
      "AUTH_SESSION_MAX_DURATION_MINUTES must be a positive integer",
    );
  });

  it("throws when a duration contains trailing characters", async () => {
    setEnvVariableMocks({ AUTH_SESSION_MAX_DURATION_MINUTES: "60abc" });

    const { buildEnvironment: init } = await import("./init");
    await expect(init()).rejects.toThrow(
      "AUTH_SESSION_MAX_DURATION_MINUTES must be a positive integer",
    );
  });

  it("throws when a duration is not a whole number", async () => {
    setEnvVariableMocks({ AUTH_SESSION_MAX_DURATION_MINUTES: "60.5" });

    const { buildEnvironment: init } = await import("./init");
    await expect(init()).rejects.toThrow(
      "AUTH_SESSION_MAX_DURATION_MINUTES must be a positive integer",
    );
  });

  it("throws when AUTH_COOKIE_SAME_SITE is not an allowed value", async () => {
    setEnvVariableMocks({ AUTH_COOKIE_SAME_SITE: "Invalid" });

    const { buildEnvironment: init } = await import("./init");
    await expect(init()).rejects.toThrow(
      "AUTH_COOKIE_SAME_SITE must be one of Strict, Lax, or None",
    );
  });

  it("throws when SameSite=None is configured without Secure", async () => {
    setEnvVariableMocks({ AUTH_COOKIE_SAME_SITE: "None", AUTH_COOKIE_SECURE: "false" });

    const { buildEnvironment: init } = await import("./init");
    await expect(init()).rejects.toThrow(
      "AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAME_SITE is None",
    );
  });

  it("throws when the preview cookie private key secret value has an invalid JSON shape", async () => {
    mockSessionLoginGetSecretValue.mockReset();
    mockSessionLoginGetSecretValue
      .mockResolvedValueOnce("test-nhs-login-private-key")
      .mockResolvedValueOnce(JSON.stringify({ key: "   " }));

    const { buildEnvironment: init } = await import("./init");
    await expect(init()).rejects.toThrow(
      "AUTH_COOKIE_PRIVATE_KEYS_SECRET_NAME secret value must be either a non-JSON private key string or a JSON object containing a non-empty 'key' entry.",
    );
  });

  describe("singleton protection", () => {
    it("constructs dependencies only once no matter how many times init() is called", async () => {
      const { init: singletonInit } = await import("./init");

      const promise1 = singletonInit();
      const promise2 = singletonInit();

      const { AwsSecretsClient } = await import("../lib/secrets/secrets-manager-client");
      expect(AwsSecretsClient).toHaveBeenCalledTimes(1);
      expect(promise1).toBe(promise2);
    });
  });

  describe("rejection retry", () => {
    it("clears the cached environment on rejection so subsequent calls can retry", async () => {
      mockSessionLoginGetSecretValue.mockReset();
      mockSessionLoginGetSecretValue
        .mockRejectedValueOnce(new Error("Secrets Manager unavailable"))
        .mockResolvedValueOnce("test-nhs-login-private-key")
        .mockResolvedValueOnce(JSON.stringify({ key: "test-preview-cookie-private-key" }));

      const { init: singletonInit } = await import("./init");

      await expect(singletonInit()).rejects.toThrow("Secrets Manager unavailable");

      const result = await singletonInit();
      expect(result).toEqual({
        sessionLoginService: mockSessionLoginServiceInstance,
        authCookieSameSite: "Lax",
        authCookieSecure: true,
      });
    });
  });
});
