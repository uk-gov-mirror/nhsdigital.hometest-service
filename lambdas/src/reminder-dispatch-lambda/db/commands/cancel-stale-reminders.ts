import { type DBClient } from "../../../lib/db/db-client";

export class CancelStaleRemindersCommand {
  constructor(private readonly dbClient: DBClient) {}

  async execute(): Promise<{ cancelledCount: number }> {
    const query = `
      UPDATE order_status_reminder r
      SET status = 'CANCELLED'
      FROM latest_order_status los
      WHERE r.order_uid = los.order_uid
        AND r.status = 'SCHEDULED'
        AND los.status_code != r.trigger_status;
    `;

    const result = await this.dbClient.query<void, []>(query, []);
    return { cancelledCount: result.rowCount ?? 0 };
  }
}
