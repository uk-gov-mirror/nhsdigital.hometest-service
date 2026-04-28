import { generateKeyPairSync } from "node:crypto";

import jwt, { type SignOptions } from "jsonwebtoken";

import { type NhsJwksKeyProvider, NhsTokenVerifier } from "./nhs-token-verifier";

interface RsaKeyPair {
  privateKey: string;
  publicKey: string;
}

function createRsaKeyPair(): RsaKeyPair {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: {
      format: "pem",
      type: "pkcs8",
    },
    publicKeyEncoding: {
      format: "pem",
      type: "spki",
    },
  });

  return { privateKey, publicKey };
}

function signNhsToken(
  payload: Record<string, unknown>,
  privateKey: string,
  options?: Omit<SignOptions, "algorithm">,
): string {
  return jwt.sign(payload, privateKey, {
    algorithm: "RS512",
    ...options,
  });
}

describe("NhsTokenVerifier", () => {
  const primaryKeys = createRsaKeyPair();
  const secondaryKeys = createRsaKeyPair();
  const issuer = "https://auth.example";

  function createKeyProvider(publicKey?: string, rejectWith?: Error): NhsJwksKeyProvider {
    const mock = jest.fn();

    if (rejectWith) {
      mock.mockRejectedValue(rejectWith);
    } else {
      mock.mockResolvedValue(publicKey ?? primaryKeys.publicKey);
    }

    return { fetchPublicKeyById: mock };
  }

  it("verifies a valid NHS token and returns payload and header", async () => {
    const keyProvider = createKeyProvider();
    const verifier = new NhsTokenVerifier({ keyProvider, issuer });
    const token = signNhsToken({ sub: "user-123" }, primaryKeys.privateKey, {
      expiresIn: "1h",
      issuer,
      header: { alg: "RS512", kid: "nhs-kid-1" },
    });

    const result = await verifier.verifyToken(token);

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("Expected successful verification");
    }

    expect(result.payload.sub).toBe("user-123");
    expect(result.payload.iss).toBe(issuer);
    expect(result.payload.exp).toEqual(expect.any(Number));
    expect(result.payload.iat).toEqual(expect.any(Number));
    expect(result.header.kid).toBe("nhs-kid-1");
    expect(result.header.alg).toBe("RS512");
    expect(keyProvider.fetchPublicKeyById).toHaveBeenCalledWith("nhs-kid-1");
  });

  it("returns DECODE_FAILURE when the token is not a valid JWT", async () => {
    const keyProvider = createKeyProvider();
    const verifier = new NhsTokenVerifier({ keyProvider, issuer });

    const result = await verifier.verifyToken("not-a-jwt");

    expect(result).toEqual({
      success: false,
      error: { code: "DECODE_FAILURE", message: "Token could not be decoded" },
    });
    expect(keyProvider.fetchPublicKeyById).not.toHaveBeenCalled();
  });

  it("returns MISSING_KID when the token header has no kid", async () => {
    const keyProvider = createKeyProvider();
    const verifier = new NhsTokenVerifier({ keyProvider, issuer });
    const token = signNhsToken({ sub: "user-123" }, primaryKeys.privateKey, {
      expiresIn: "1h",
      issuer,
    });

    const result = await verifier.verifyToken(token);

    expect(result).toEqual({
      success: false,
      error: { code: "MISSING_KID", message: "kid is not present in the token header" },
    });
    expect(keyProvider.fetchPublicKeyById).not.toHaveBeenCalled();
  });

  it("returns KEY_RESOLUTION_FAILED when the key provider throws", async () => {
    const keyProvider = createKeyProvider(undefined, new Error("JWKS lookup failed"));
    const verifier = new NhsTokenVerifier({ keyProvider, issuer });
    const token = signNhsToken({ sub: "user-123" }, primaryKeys.privateKey, {
      expiresIn: "1h",
      issuer,
      header: { alg: "RS512", kid: "unknown-kid" },
    });

    const result = await verifier.verifyToken(token);

    expect(result).toEqual({
      success: false,
      error: {
        code: "KEY_RESOLUTION_FAILED",
        message: "Failed to resolve public key for the token",
      },
    });
  });

  it("returns KEY_RESOLUTION_FAILED when the key provider returns an empty string", async () => {
    const keyProvider = createKeyProvider("");
    const verifier = new NhsTokenVerifier({ keyProvider, issuer });
    const token = signNhsToken({ sub: "user-123" }, primaryKeys.privateKey, {
      expiresIn: "1h",
      issuer,
      header: { alg: "RS512", kid: "nhs-kid-1" },
    });

    const result = await verifier.verifyToken(token);

    expect(result).toEqual({
      success: false,
      error: {
        code: "KEY_RESOLUTION_FAILED",
        message: "No public key was returned for the token",
      },
    });
  });

  it("returns INVALID_SIGNATURE when the token is signed with a different key", async () => {
    const keyProvider = createKeyProvider(secondaryKeys.publicKey);
    const verifier = new NhsTokenVerifier({ keyProvider, issuer });
    const token = signNhsToken({ sub: "user-123" }, primaryKeys.privateKey, {
      expiresIn: "1h",
      issuer,
      header: { alg: "RS512", kid: "nhs-kid-1" },
    });

    const result = await verifier.verifyToken(token);

    expect(result).toEqual({
      success: false,
      error: { code: "INVALID_SIGNATURE", message: "Token signature is invalid" },
    });
  });

  it("returns TOKEN_EXPIRED when the token has expired", async () => {
    const keyProvider = createKeyProvider();
    const verifier = new NhsTokenVerifier({ keyProvider, issuer });
    const token = signNhsToken({ sub: "user-123" }, primaryKeys.privateKey, {
      expiresIn: "-10s",
      issuer,
      header: { alg: "RS512", kid: "nhs-kid-1" },
    });

    const result = await verifier.verifyToken(token);

    expect(result).toEqual({
      success: false,
      error: { code: "TOKEN_EXPIRED", message: "Token has expired" },
    });
  });

  it("returns INVALID_ISSUER when the token issuer does not match", async () => {
    const keyProvider = createKeyProvider();
    const verifier = new NhsTokenVerifier({ keyProvider, issuer });
    const token = signNhsToken({ sub: "user-123" }, primaryKeys.privateKey, {
      expiresIn: "1h",
      issuer: "https://wrong-issuer.example",
      header: { alg: "RS512", kid: "nhs-kid-1" },
    });

    const result = await verifier.verifyToken(token);

    expect(result).toEqual({
      success: false,
      error: {
        code: "INVALID_ISSUER",
        message: "Token issuer does not match expected issuer",
      },
    });
  });

  it("returns VERIFICATION_FAILED for other jwt verification errors", async () => {
    const keyProvider = createKeyProvider();
    const verifier = new NhsTokenVerifier({ keyProvider, issuer });
    // Sign with RS256 instead of RS512 to trigger algorithm mismatch
    const token = jwt.sign({ sub: "user-123" }, primaryKeys.privateKey, {
      algorithm: "RS256",
      expiresIn: "1h",
      issuer,
      header: { alg: "RS256", kid: "nhs-kid-1" },
    });

    const result = await verifier.verifyToken(token);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected failure");
    }
    expect(result.error).toEqual({
      code: "VERIFICATION_FAILED",
      message: "Token verification failed",
    });
  });
});
