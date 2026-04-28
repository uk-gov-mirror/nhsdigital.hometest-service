import { type DBClient } from "../../../lib/db/db-client";
import { ResultStatus } from "../../../lib/types/status";

export class InsertResultStatusCommand {
  constructor(private readonly dbClient: DBClient) {}

  async execute(orderId: string, status: ResultStatus, correlationId: string): Promise<void> {
    const query = `
      INSERT INTO result_status (order_uid, status, correlation_id)
      VALUES ($1::uuid, $2, $3::uuid)
      ON CONFLICT (correlation_id) DO NOTHING;
    `;

    await this.dbClient.query<void, [string, ResultStatus, string]>(query, [
      orderId,
      status,
      correlationId,
    ]);
  }
}
