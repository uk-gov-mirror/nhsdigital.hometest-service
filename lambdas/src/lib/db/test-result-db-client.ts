import { type DBClient } from "./db-client";

type TestResultStatusCode = "RESULT_AVAILABLE" | "RESULT_WITHHELD";

export interface TestResult {
  id: number;
  status: TestResultStatusCode;
  supplier_id: string;
}

export class TestResultDbClient {
  constructor(private readonly dbClient: DBClient) {}

  public async getResult(orderId: string, nhsNumber: string, dateOfBirth: Date) {
    const query = `
      SELECT
          rs.result_id AS id,
          rs.status as status,
          o.supplier_id AS supplier_id
      FROM test_order o
      INNER JOIN patient_mapping p ON p.patient_uid = o.patient_uid
      INNER JOIN result_status rs ON rs.order_uid = o.order_uid
      WHERE
          (
            SELECT os.status_code = 'COMPLETE'
            FROM order_status os
            WHERE os.order_uid = $1::uuid
            ORDER BY os.created_at DESC
            LIMIT 1
          ) AND
          o.order_uid = $1::uuid AND
          p.nhs_number = $2 AND
          p.birth_date = $3::date
      ORDER BY rs.created_at DESC
      LIMIT 1;
    `;

    const result = await this.dbClient.query<TestResult, [string, string, Date]>(query, [
      orderId,
      nhsNumber,
      dateOfBirth,
    ]);

    return result?.rows[0] ?? null;
  }
}
