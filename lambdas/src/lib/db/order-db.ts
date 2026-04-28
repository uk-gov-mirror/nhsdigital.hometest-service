import { OrderStatus, ResultStatus } from "../types/status";
import { DBClient } from "./db-client";

export interface OrderResultSummary {
  order_uid: string;
  supplier_id: string;
  patient_uid: string;
  result_status: ResultStatus | null;
  correlation_id: string | null;
  order_status_code: OrderStatus | null;
}

export class OrderService {
  private readonly dbClient: DBClient;
  constructor(dbClient: DBClient) {
    this.dbClient = dbClient;
  }

  async retrieveOrderDetails(orderUid: string): Promise<OrderResultSummary | null> {
    const query = `
            SELECT
              o.order_uid,
              o.supplier_id,
              o.patient_uid,
              r.status AS result_status,
              r.correlation_id,
              los.status_code AS order_status_code
            FROM test_order o
            LEFT JOIN Lateral (
              SELECT
                r.status,
                r.correlation_id
              FROM result_status r
              WHERE o.order_uid = r.order_uid
              ORDER BY r.created_at DESC LIMIT 1
            ) r ON true
            LEFT JOIN latest_order_status los ON los.order_uid = o.order_uid
            WHERE o.order_uid = $1::uuid;
        `;

    try {
      const result = await this.dbClient.query<OrderResultSummary, [string]>(query, [orderUid]);
      return result.rows[0] || null;
    } catch (error) {
      console.error("order-db", "Failed to retrieve order details", { error, orderUid });
      throw error;
    }
  }

  async updateOrderStatusAndResultStatus(
    orderUid: string,
    statusCode: OrderStatus,
    resultStatus: ResultStatus,
    correlationId: string,
  ): Promise<void> {
    try {
      await this.dbClient.withTransaction(async (dbClient) => {
        const orderStatusQuery = `
          INSERT INTO order_status (order_uid, status_code, correlation_id)
          SELECT $1::uuid, $2::varchar(50), $3::uuid
          WHERE NOT EXISTS (
            SELECT 1 FROM latest_order_status
            WHERE order_uid = $1::uuid AND status_code = $2::varchar(50)
          );
          `;
        await dbClient.query(orderStatusQuery, [orderUid, statusCode, correlationId]);

        const resultStatusQuery = `
          INSERT INTO result_status (order_uid, status, correlation_id)
          VALUES ($1::uuid, $2, $3::uuid);
          `;
        await dbClient.query(resultStatusQuery, [orderUid, resultStatus, correlationId]);
      });
    } catch (error) {
      console.error("order-db", "Failed to update order and result status", {
        error,
        orderUid,
        correlationId,
        statusCode,
        resultStatus,
      });
      throw new Error(`Failed to update order and result status`, { cause: error });
    }
  }
}
