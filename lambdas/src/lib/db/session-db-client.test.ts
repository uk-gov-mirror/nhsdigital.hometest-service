import { type DBClient } from "./db-client";
import {
  type CreateSessionInput,
  SessionDbClient,
  type UpdateSessionInput,
} from "./session-db-client";

const sessionId = "550e8400-e29b-41d4-a716-446655440000";
const refreshTokenId = "650e8400-e29b-41d4-a716-446655440000";

async function expectSanitizedFailure<T>(
  promise: Promise<T>,
  expectedMessage: string,
): Promise<void> {
  expect.assertions(3);

  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ message: expectedMessage });
    expect(error).not.toHaveProperty("cause");
  }
}

function buildCreateSessionInput(overrides: Partial<CreateSessionInput> = {}): CreateSessionInput {
  return {
    sessionId,
    refreshTokenId,
    nhsAccessToken: "nhs-access-token",
    userInfo: {
      issuer: "issuer",
      audience: "audience",
      subject: "subject",
      familyName: "Doe",
      givenName: "Jane",
      identityProofingLevel: "P9",
      email: "jane@example.com",
      emailVerified: true,
      phoneNumberVerified: false,
      birthDate: "1990-01-01",
      nhsNumber: "1234567890",
      gpOdsCode: "A12345",
    },
    sessionCreatedAt: "2026-04-10T09:00:00.000Z",
    lastRefreshAt: "2026-04-10T09:10:00.000Z",
    maxExpiresAt: "2026-04-10T10:00:00.000Z",
    ...overrides,
  };
}

function buildSessionRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const session = buildCreateSessionInput();

  return {
    session_id: session.sessionId,
    refresh_token_id: session.refreshTokenId,
    nhs_access_token: session.nhsAccessToken,
    issuer: session.userInfo.issuer,
    audience: session.userInfo.audience,
    subject: session.userInfo.subject,
    family_name: session.userInfo.familyName,
    given_name: session.userInfo.givenName,
    identity_proofing_level: session.userInfo.identityProofingLevel,
    email: session.userInfo.email,
    email_verified: session.userInfo.emailVerified,
    phone_number_verified: session.userInfo.phoneNumberVerified,
    birth_date: session.userInfo.birthDate,
    nhs_number: session.userInfo.nhsNumber,
    gp_ods_code: session.userInfo.gpOdsCode,
    session_created_at: session.sessionCreatedAt,
    last_refresh_at: session.lastRefreshAt,
    max_expires_at: session.maxExpiresAt,
    ...overrides,
  };
}

describe("SessionDbClient", () => {
  let mockDbClient: jest.Mocked<DBClient>;
  let sessionDbClient: SessionDbClient;

  beforeEach(() => {
    mockDbClient = {
      query: jest.fn(),
      withTransaction: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };

    sessionDbClient = new SessionDbClient(mockDbClient, {
      initialDelayMs: 0,
      jitter: false,
      maxDelayMs: 0,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createSession", () => {
    it("should insert and return the session", async () => {
      const row = buildSessionRow();
      mockDbClient.query.mockResolvedValue({
        rows: [row],
        rowCount: 1,
      });

      const session = buildCreateSessionInput();
      const result = await sessionDbClient.createSession(session);

      expect(result).toEqual(session);
      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO session"),
        [
          session.sessionId,
          session.refreshTokenId,
          session.nhsAccessToken,
          session.userInfo.issuer,
          session.userInfo.audience,
          session.userInfo.subject,
          session.userInfo.familyName,
          session.userInfo.givenName,
          session.userInfo.identityProofingLevel,
          session.userInfo.email,
          session.userInfo.emailVerified,
          session.userInfo.phoneNumberVerified,
          session.userInfo.birthDate,
          session.userInfo.nhsNumber,
          session.userInfo.gpOdsCode,
          session.sessionCreatedAt,
          session.lastRefreshAt,
          session.maxExpiresAt,
        ],
      );

      const [query] = mockDbClient.query.mock.calls[0];
      expect(query).toContain("$13::date");
      expect(query).not.toContain("ON CONFLICT (session_id) DO UPDATE");
    });

    it("should retry transient insert failures", async () => {
      const transientError = Object.assign(new Error("connection reset"), {
        code: "ECONNRESET",
      });
      mockDbClient.query
        .mockRejectedValueOnce(transientError)
        .mockResolvedValue({ rows: [buildSessionRow()], rowCount: 1 });

      const result = await sessionDbClient.createSession(buildCreateSessionInput());

      expect(result.sessionId).toBe(sessionId);
      expect(mockDbClient.query).toHaveBeenCalledTimes(2);
    });

    it("should throw when no row is returned", async () => {
      mockDbClient.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      await expect(sessionDbClient.createSession(buildCreateSessionInput())).rejects.toThrow(
        `Failed to create session for sessionId ${sessionId}`,
      );
    });

    it("should throw on database failure", async () => {
      const dbError = Object.assign(new Error("db down with token nhs-access-token"), {
        code: "23514",
      });
      mockDbClient.query.mockRejectedValue(dbError);

      await expectSanitizedFailure(
        sessionDbClient.createSession(buildCreateSessionInput()),
        `Failed to create session for sessionId ${sessionId}`,
      );
    });
  });

  describe("getSession", () => {
    it("should return the session when found", async () => {
      mockDbClient.query.mockResolvedValue({
        rows: [buildSessionRow()],
        rowCount: 1,
      });

      const result = await sessionDbClient.getSession(sessionId);

      expect(result).toEqual(buildCreateSessionInput());
      expect(mockDbClient.query).toHaveBeenCalledWith(expect.stringContaining("FROM session"), [
        sessionId,
      ]);
    });

    it("should return null when the session does not exist", async () => {
      mockDbClient.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      await expect(sessionDbClient.getSession(sessionId)).resolves.toBeNull();
    });

    it("should sanitize database failures", async () => {
      const dbError = Object.assign(new Error("bad row for nhs number 1234567890"), {
        code: "08006",
      });
      mockDbClient.query.mockRejectedValue(dbError);

      await expectSanitizedFailure(
        sessionDbClient.getSession(sessionId),
        `Failed to fetch session for sessionId ${sessionId}`,
      );
    });

    it("should map all user info fields from row columns to session model", async () => {
      mockDbClient.query.mockResolvedValue({
        rows: [
          buildSessionRow({
            issuer: "https://issuer.example",
            audience: "client-id",
            subject: "subject-123",
            family_name: "Smith",
            given_name: "Jo",
            identity_proofing_level: "P5",
            email: "jo@example.com",
            email_verified: false,
            phone_number_verified: true,
            birth_date: "1985-05-05",
            nhs_number: "9999999999",
            gp_ods_code: "B12345",
          }),
        ],
        rowCount: 1,
      });

      const result = await sessionDbClient.getSession(sessionId);

      expect(result?.userInfo).toEqual({
        issuer: "https://issuer.example",
        audience: "client-id",
        subject: "subject-123",
        familyName: "Smith",
        givenName: "Jo",
        identityProofingLevel: "P5",
        email: "jo@example.com",
        emailVerified: false,
        phoneNumberVerified: true,
        birthDate: "1985-05-05",
        nhsNumber: "9999999999",
        gpOdsCode: "B12345",
      });
    });
  });

  describe("updateSession", () => {
    it("should update the provided session fields", async () => {
      const updates: UpdateSessionInput = {
        refreshTokenId: "750e8400-e29b-41d4-a716-446655440000",
        nhsAccessToken: "updated-nhs-access-token",
        lastRefreshAt: "2026-04-10T09:15:00.000Z",
        maxExpiresAt: "2026-04-10T10:15:00.000Z",
      };

      mockDbClient.query.mockResolvedValue({
        rows: [
          buildSessionRow({
            refresh_token_id: updates.refreshTokenId,
            nhs_access_token: updates.nhsAccessToken,
            last_refresh_at: updates.lastRefreshAt,
            max_expires_at: updates.maxExpiresAt,
          }),
        ],
        rowCount: 1,
      });

      const result = await sessionDbClient.updateSession(sessionId, updates);

      expect(result.refreshTokenId).toBe("750e8400-e29b-41d4-a716-446655440000");
      expect(result.nhsAccessToken).toBe("updated-nhs-access-token");
      expect(result.lastRefreshAt).toBe("2026-04-10T09:15:00.000Z");
      expect(result.maxExpiresAt).toBe("2026-04-10T10:15:00.000Z");

      const [query, values] = mockDbClient.query.mock.calls[0];
      expect(query).toContain("refresh_token_id = $1::uuid");
      expect(query).toContain("nhs_access_token = $2");
      expect(query).toContain("last_refresh_at = $3::timestamptz");
      expect(query).toContain("max_expires_at = $4::timestamptz");
      expect(values).toEqual([
        "750e8400-e29b-41d4-a716-446655440000",
        "updated-nhs-access-token",
        "2026-04-10T09:15:00.000Z",
        "2026-04-10T10:15:00.000Z",
        sessionId,
      ]);
    });

    it("should reject empty session updates", async () => {
      await expect(sessionDbClient.updateSession(sessionId, {})).rejects.toThrow(
        `No session updates provided for sessionId ${sessionId}`,
      );
      expect(mockDbClient.query).not.toHaveBeenCalled();
    });

    it("should throw when no session is updated", async () => {
      mockDbClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await expect(
        sessionDbClient.updateSession(sessionId, {
          lastRefreshAt: "2026-04-10T09:15:00.000Z",
        }),
      ).rejects.toThrow(`Failed to update session for sessionId ${sessionId}`);
    });

    it("should sanitize update database failures", async () => {
      const dbError = Object.assign(new Error("update failed for birth date 1990-01-01"), {
        code: "23505",
      });
      mockDbClient.query.mockRejectedValue(dbError);

      await expectSanitizedFailure(
        sessionDbClient.updateSession(sessionId, {
          lastRefreshAt: "2026-04-10T09:15:00.000Z",
        }),
        `Failed to update session for sessionId ${sessionId}`,
      );
    });
  });

  describe("deleteSession", () => {
    it("should delete the session", async () => {
      mockDbClient.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await expect(sessionDbClient.deleteSession(sessionId)).resolves.toBeUndefined();
      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM session"),
        [sessionId],
      );
    });

    it("should throw when the session does not exist", async () => {
      mockDbClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await expect(sessionDbClient.deleteSession(sessionId)).rejects.toThrow(
        `Failed to delete session for sessionId ${sessionId}`,
      );
    });

    it("should sanitize delete database failures", async () => {
      const dbError = Object.assign(new Error("delete failed for token nhs-access-token"), {
        code: "08006",
      });
      mockDbClient.query.mockRejectedValue(dbError);

      await expectSanitizedFailure(
        sessionDbClient.deleteSession(sessionId),
        `Failed to delete session for sessionId ${sessionId}`,
      );
    });
  });
});
