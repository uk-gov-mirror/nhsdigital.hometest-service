import { type JwksClient } from "jwks-rsa";

import { type HttpClient } from "../http/http-client";
import { type INhsLoginConfig } from "../models/nhs-login/nhs-login-config";
import { type INhsTokenResponseModel } from "../models/nhs-login/nhs-login-token-response-model";
import { type INhsUserInfoResponseModel } from "../models/nhs-login/nhs-login-user-info-response-model";
import { NhsLoginClient } from "./nhs-login-client";
import { type NhsLoginJwtHelper } from "./nhs-login-jwt-helper";
import * as testUserMapping from "./test-user-mapping";

function createUserInfo(
  overrides: Partial<INhsUserInfoResponseModel> = {},
): INhsUserInfoResponseModel {
  const defaults: INhsUserInfoResponseModel = {
    iss: "https://issuer.example",
    aud: "hometest",
    sub: "user-123",
    family_name: "MILLAR",
    given_name: "",
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

describe("NhsLoginClient.getUserInfo", () => {
  const nhsLoginConfig: INhsLoginConfig = {
    clientId: "client-id",
    expiresIn: 300,
    redirectUri: "https://example.com/callback",
    baseUri: "https://auth.sandpit.signin.nhs.uk",
    privateKey: "private-key",
  };

  const jwtHelperMock = {
    createClientAuthJwt: jest.fn().mockReturnValue("signed-jwt"),
  } as unknown as NhsLoginJwtHelper;

  const jwksClientMock = {
    getSigningKey: jest.fn(),
  } as unknown as JwksClient;

  it("enriches user info when userinfo has missing given_name", async () => {
    const rawUserInfo = createUserInfo({ family_name: "MILLAR", given_name: "" });
    const httpClientMock: Pick<HttpClient, "get" | "post" | "postRaw"> = {
      get: jest.fn().mockResolvedValue(rawUserInfo),
      post: jest.fn(),
      postRaw: jest.fn(),
    };

    const enrichSpy = jest.spyOn(testUserMapping, "enrichUserInfoWithTestFirstName");

    const client = new NhsLoginClient(
      nhsLoginConfig,
      jwtHelperMock,
      httpClientMock as unknown as HttpClient,
      jwksClientMock,
    );

    const result = await client.getUserInfo("access-token");

    expect(httpClientMock.get).toHaveBeenCalledWith("https://auth.sandpit.signin.nhs.uk/userinfo", {
      Authorization: "Bearer access-token",
    });
    expect(enrichSpy).toHaveBeenCalledWith(rawUserInfo);
    expect(result.given_name).toBe("Mona");

    enrichSpy.mockRestore();
  });

  it("returns user info without enrichment when given_name is present", async () => {
    const rawUserInfo = createUserInfo({ family_name: "MILLAR", given_name: "Eric" });
    const httpClientMock: Pick<HttpClient, "get" | "post" | "postRaw"> = {
      get: jest.fn().mockResolvedValue(rawUserInfo),
      post: jest.fn(),
      postRaw: jest.fn(),
    };

    const enrichSpy = jest.spyOn(testUserMapping, "enrichUserInfoWithTestFirstName");

    const client = new NhsLoginClient(
      nhsLoginConfig,
      jwtHelperMock,
      httpClientMock as unknown as HttpClient,
      jwksClientMock,
    );

    const result = await client.getUserInfo("access-token");

    expect(httpClientMock.get).toHaveBeenCalledWith("https://auth.sandpit.signin.nhs.uk/userinfo", {
      Authorization: "Bearer access-token",
    });
    expect(enrichSpy).toHaveBeenCalledWith(rawUserInfo);
    expect(result.given_name).toBe("Eric");

    enrichSpy.mockRestore();
  });
});

describe("NhsLoginClient.fetchPublicKeyById", () => {
  const nhsLoginConfig: INhsLoginConfig = {
    clientId: "client-id",
    expiresIn: 300,
    redirectUri: "https://example.com/callback",
    baseUri: "https://auth.example",
    privateKey: "private-key",
  };

  const jwtHelperMock = {
    createClientAuthJwt: jest.fn().mockReturnValue("signed-jwt"),
  } as unknown as NhsLoginJwtHelper;

  const jwksClientMock = {
    getSigningKey: jest.fn().mockResolvedValue({
      getPublicKey: () => "public-key",
    }),
  } as unknown as JwksClient;

  const httpClientMock: Pick<HttpClient, "get" | "post" | "postRaw"> = {
    get: jest.fn(),
    post: jest.fn(),
    postRaw: jest.fn(),
  };

  it("fetches public key by key id", async () => {
    const client = new NhsLoginClient(
      nhsLoginConfig,
      jwtHelperMock,
      httpClientMock as unknown as HttpClient,
      jwksClientMock,
    );

    const result = await client.fetchPublicKeyById("test-key-id");

    expect(jwksClientMock.getSigningKey).toHaveBeenCalledWith("test-key-id");
    expect(result).toBe("public-key");
  });
});

describe("NhsLoginClient.getUserTokens", () => {
  const nhsLoginConfig: INhsLoginConfig = {
    clientId: "client-id",
    expiresIn: 300,
    redirectUri: "https://example.com/callback",
    baseUri: "https://auth.example",
    privateKey: "private-key",
  };

  const jwtHelperMock = {
    createClientAuthJwt: jest.fn().mockReturnValue("signed-jwt"),
  } as unknown as NhsLoginJwtHelper;

  const jwksClientMock = {
    getSigningKey: jest.fn(),
  } as unknown as JwksClient;

  const tokenResponse: INhsTokenResponseModel = {
    access_token: "user-access-token",
    id_token: "id-token",
    refresh_token: "refresh-token",
    token_type: "Bearer",
    expires_in: "3600",
    scope: "openid profile",
  };

  const httpClientMock: Pick<HttpClient, "get" | "post" | "postRaw"> = {
    get: jest.fn(),
    post: jest.fn().mockResolvedValue(tokenResponse),
    postRaw: jest.fn(),
  };

  it("exchanges authorization code for user tokens", async () => {
    const client = new NhsLoginClient(
      nhsLoginConfig,
      jwtHelperMock,
      httpClientMock as unknown as HttpClient,
      jwksClientMock,
    );

    const result = await client.getUserTokens("auth-code");

    expect(jwtHelperMock.createClientAuthJwt).toHaveBeenCalled();
    expect(httpClientMock.post).toHaveBeenCalledTimes(1);

    const postRequestMock = httpClientMock.post as jest.Mock;
    const firstCallArgs = postRequestMock.mock.calls[0];
    const [url, params, headers] = firstCallArgs;

    expect(url).toBe("https://auth.example/token");
    expect(headers).toEqual({
      "Content-Type": "application/x-www-form-urlencoded",
    });
    expect(params).toBeInstanceOf(URLSearchParams);
    expect(params.get("code")).toBe("auth-code");
    expect(params.get("client_id")).toBe(nhsLoginConfig.clientId);
    expect(params.get("redirect_uri")).toBe(nhsLoginConfig.redirectUri);
    expect(params.get("grant_type")).toBe("authorization_code");
    expect(params.get("client_assertion_type")).toBe(
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    );
    expect(result).toEqual(tokenResponse);
  });
});
