import { type DBClient } from "../../../lib/db/db-client";
import { CancelStaleRemindersCommand } from "./cancel-stale-reminders";

const normalizeWhitespace = (sql: string): string => sql.replace(/\s+/g, " ").trim();

describe("CancelStaleRemindersCommand", () => {
  let dbClient: jest.Mocked<Pick<DBClient, "query" | "withTransaction" | "close">>;
  let command: CancelStaleRemindersCommand;

  beforeEach(() => {
    jest.clearAllMocks();

    dbClient = {
      query: jest.fn(),
      withTransaction: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };

    command = new CancelStaleRemindersCommand(dbClient as DBClient);
  });

  const expectedQuery = `
      UPDATE order_status_reminder r
      SET status = 'CANCELLED'
      FROM latest_order_status los
      WHERE r.order_uid = los.order_uid
        AND r.status = 'SCHEDULED'
        AND los.status_code != r.trigger_status;
    `;

  it("executes the correct SQL with no parameters", async () => {
    dbClient.query.mockResolvedValue({ rows: [], rowCount: 5 });

    await command.execute();

    expect(dbClient.query).toHaveBeenCalledTimes(1);
    expect(normalizeWhitespace(dbClient.query.mock.calls[0][0])).toBe(
      normalizeWhitespace(expectedQuery),
    );
    expect(dbClient.query.mock.calls[0][1]).toEqual([]);
  });

  it("returns cancelledCount from rowCount", async () => {
    dbClient.query.mockResolvedValue({ rows: [], rowCount: 3 });

    const result = await command.execute();

    expect(result).toEqual({ cancelledCount: 3 });
  });

  it("returns cancelledCount of 0 when rowCount is null", async () => {
    dbClient.query.mockResolvedValue({ rows: [], rowCount: null });

    const result = await command.execute();

    expect(result).toEqual({ cancelledCount: 0 });
  });

  it("returns cancelledCount of 0 when no stale reminders exist", async () => {
    dbClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const result = await command.execute();

    expect(result).toEqual({ cancelledCount: 0 });
  });
});
