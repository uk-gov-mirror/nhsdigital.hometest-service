import { JwksClient } from "jwks-rsa";

import { SessionTokenService } from "../lib/auth/session-token-service";
import { PostgresDbClient } from "../lib/db/db-client";
import { postgresConfigFromEnv } from "../lib/db/db-config";
import { SessionDbClient } from "../lib/db/session-db-client";
import { FetchHttpClient } from "../lib/http/http-client";
import { NhsLoginClient } from "../lib/login/nhs-login-client";
import { NhsLoginJwtHelper } from "../lib/login/nhs-login-jwt-helper";
import { NhsLoginService } from "../lib/login/nhs-login-service";
import { NhsTokenVerifier } from "../lib/login/nhs-token-verifier";
import { type INhsLoginConfig } from "../lib/models/nhs-login/nhs-login-config";
import { AwsSecretsClient } from "../lib/secrets/secrets-manager-client";
import {
  retrieveMandatoryEnvVariable,
  retrieveOptionalEnvVariable,
  retrieveOptionalEnvVariableWithDefault,
} from "../lib/utils/utils";
import { type PreviewCookieSameSite, parsePreviewCookieSameSite } from "./cookies";
import { type ISessionLoginService } from "./session-login-service";
import { SessionLoginService } from "./session-login-service";

interface SessionLoginEnvVariables {
  awsRegion: string;
  nhsLoginBaseEndpointUrl: string;
  nhsLoginJwksUri: string | undefined;
  nhsLoginClientId: string;
  nhsLoginRedirectUrl: string;
  nhsLoginPrivateKeySecretName: string;
  authCookiePrivateKeysSecretName: string;
  authSessionMaxDurationMinutes: number;
  authAccessTokenExpiryDurationMinutes: number;
  authRefreshTokenExpiryDurationMinutes: number;
  authCookieSameSite: PreviewCookieSameSite;
  authCookieSecure: boolean;
}

export interface SessionLoginLambdaDependencies {
  sessionLoginService: ISessionLoginService;
  authCookieSameSite: PreviewCookieSameSite;
  authCookieSecure: boolean;
}

function parsePositiveInteger(name: string, value: string): number {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsedValue;
}

function parseAuthCookiePrivateKey(secretValue: string): string {
  try {
    const parsedSecret = JSON.parse(secretValue) as Record<string, unknown>;
    const privateKey = parsedSecret.key;

    if (typeof privateKey === "string" && privateKey.trim().length > 0) {
      return privateKey;
    }

    throw new Error(
      "AUTH_COOKIE_PRIVATE_KEYS_SECRET_NAME secret value must be either a non-JSON private key string or a JSON object containing a non-empty 'key' entry.",
    );
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }
  }

  if (secretValue.trim().length === 0) {
    throw new Error("AUTH_COOKIE_PRIVATE_KEYS_SECRET_NAME secret value must not be empty.");
  }

  return secretValue;
}

function loadEnv(): SessionLoginEnvVariables {
  const authCookieSecure =
    retrieveOptionalEnvVariableWithDefault("AUTH_COOKIE_SECURE", "true").toLowerCase() === "true";

  return {
    awsRegion: retrieveMandatoryEnvVariable("AWS_REGION"),
    nhsLoginBaseEndpointUrl: retrieveMandatoryEnvVariable("NHS_LOGIN_BASE_ENDPOINT_URL"),
    nhsLoginJwksUri: retrieveOptionalEnvVariable("NHS_LOGIN_JWKS_URI"),
    nhsLoginClientId: retrieveMandatoryEnvVariable("NHS_LOGIN_CLIENT_ID"),
    nhsLoginRedirectUrl: retrieveMandatoryEnvVariable("NHS_LOGIN_REDIRECT_URL"),
    nhsLoginPrivateKeySecretName: retrieveMandatoryEnvVariable("NHS_LOGIN_PRIVATE_KEY_SECRET_NAME"),
    authCookiePrivateKeysSecretName: retrieveMandatoryEnvVariable(
      "AUTH_COOKIE_PRIVATE_KEYS_SECRET_NAME",
    ),
    authSessionMaxDurationMinutes: parsePositiveInteger(
      "AUTH_SESSION_MAX_DURATION_MINUTES",
      retrieveMandatoryEnvVariable("AUTH_SESSION_MAX_DURATION_MINUTES"),
    ),
    authAccessTokenExpiryDurationMinutes: parsePositiveInteger(
      "AUTH_ACCESS_TOKEN_EXPIRY_DURATION_MINUTES",
      retrieveMandatoryEnvVariable("AUTH_ACCESS_TOKEN_EXPIRY_DURATION_MINUTES"),
    ),
    authRefreshTokenExpiryDurationMinutes: parsePositiveInteger(
      "AUTH_REFRESH_TOKEN_EXPIRY_DURATION_MINUTES",
      retrieveMandatoryEnvVariable("AUTH_REFRESH_TOKEN_EXPIRY_DURATION_MINUTES"),
    ),
    authCookieSameSite: parsePreviewCookieSameSite(
      retrieveMandatoryEnvVariable("AUTH_COOKIE_SAME_SITE"),
      authCookieSecure,
    ),
    authCookieSecure,
  };
}

export async function buildEnvironment(): Promise<SessionLoginLambdaDependencies> {
  const envVars = loadEnv();
  const secretsClient = new AwsSecretsClient(envVars.awsRegion);
  const nhsLoginPrivateKey = await secretsClient.getSecretValue(
    envVars.nhsLoginPrivateKeySecretName,
  );
  const authCookiePrivateKeySecret = await secretsClient.getSecretValue(
    envVars.authCookiePrivateKeysSecretName,
  );

  const nhsLoginConfig: INhsLoginConfig = {
    clientId: envVars.nhsLoginClientId,
    expiresIn: 60,
    redirectUri: envVars.nhsLoginRedirectUrl,
    baseUri: envVars.nhsLoginBaseEndpointUrl,
    privateKey: nhsLoginPrivateKey,
    jwksUri: envVars.nhsLoginJwksUri || undefined,
  };

  const nhsLoginJwtHelper = new NhsLoginJwtHelper(nhsLoginConfig);
  const httpClient = new FetchHttpClient();
  const jwksClient = new JwksClient({
    cache: true,
    rateLimit: true,
    jwksUri: nhsLoginConfig.jwksUri ?? `${nhsLoginConfig.baseUri}/.well-known/jwks.json`,
  });
  const nhsLoginClient = new NhsLoginClient(
    nhsLoginConfig,
    nhsLoginJwtHelper,
    httpClient,
    jwksClient,
  );
  const nhsTokenVerifier = new NhsTokenVerifier({
    keyProvider: nhsLoginClient,
    issuer: nhsLoginConfig.baseUri,
  });
  const nhsLoginService = new NhsLoginService({
    nhsTokenVerifier,
    nhsLoginClient,
  });
  const dbClient = new PostgresDbClient(postgresConfigFromEnv(secretsClient));
  const sessionDbClient = new SessionDbClient(dbClient);
  const sessionTokenService = new SessionTokenService({
    privateKey: parseAuthCookiePrivateKey(authCookiePrivateKeySecret),
    accessTokenExpiryDurationMinutes: envVars.authAccessTokenExpiryDurationMinutes,
    refreshTokenExpiryDurationMinutes: envVars.authRefreshTokenExpiryDurationMinutes,
  });
  const sessionLoginService = new SessionLoginService({
    nhsLoginService,
    sessionDbClient,
    sessionTokenService,
    sessionMaxDurationMinutes: envVars.authSessionMaxDurationMinutes,
    nhsLoginClientId: envVars.nhsLoginClientId,
  });

  return {
    sessionLoginService,
    authCookieSameSite: envVars.authCookieSameSite,
    authCookieSecure: envVars.authCookieSecure,
  };
}

let _env: Promise<SessionLoginLambdaDependencies> | undefined;

export function init(): Promise<SessionLoginLambdaDependencies> {
  _env ??= buildEnvironment().catch((error) => {
    _env = undefined;
    throw error;
  });
  return _env;
}
