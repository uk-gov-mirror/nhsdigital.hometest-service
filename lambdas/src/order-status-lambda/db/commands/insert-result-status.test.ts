import { type DBClient } from "../../../lib/db/db-client";
import { ResultStatus } from "../../../lib/types/status";
import { InsertResultStatusCommand } from "./insert-result-status";

const normalizeWhitespace = (sql: string): string => sql.replace(/\s+/g, " ").trim();

describe("InsertResultStatusCommand", () => {
  let dbClient: jest.Mocked<Pick<DBClient, "query" | "withTransaction" | "close">>;
  let command: InsertResultStatusCommand;

  beforeEach(() => {
    jest.clearAllMocks();

    dbClient = {
      query: jest.fn(),
      withTransaction: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };

    command = new InsertResultStatusCommand(dbClient as DBClient);
  });

  const expectedQuery = `
      INSERT INTO result_status (order_uid, status, correlation_id)
      VALUES ($1::uuid, $2, $3::uuid)
      ON CONFLICT (correlation_id) DO NOTHING;
    `;

  it("executes the correct SQL with all parameters", async () => {
    dbClient.query.mockResolvedValue({ rows: [], rowCount: 1 });

    await command.execute(
      "9f44d6e9-7829-49f1-a327-8eca95f5db32",
      ResultStatus.Result_Processed,
      "c1a2b3c4-d5e6-7890-abcd-ef1234567890",
    );

    expect(dbClient.query).toHaveBeenCalledTimes(1);
    expect(normalizeWhitespace(dbClient.query.mock.calls[0][0])).toBe(
      normalizeWhitespace(expectedQuery),
    );
    expect(dbClient.query.mock.calls[0][1]).toEqual([
      "9f44d6e9-7829-49f1-a327-8eca95f5db32",
      ResultStatus.Result_Processed,
      "c1a2b3c4-d5e6-7890-abcd-ef1234567890",
    ]);
  });

  it("inserts with ON CONFLICT DO NOTHING for duplicate correlation IDs", async () => {
    dbClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

    await command.execute(
      "9f44d6e9-7829-49f1-a327-8eca95f5db32",
      ResultStatus.Result_Processed,
      "c1a2b3c4-d5e6-7890-abcd-ef1234567890",
    );

    expect(dbClient.query).toHaveBeenCalledTimes(1);
  });
});
