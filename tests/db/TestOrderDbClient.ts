import {
  CreateOrderInput,
  OrderStatusCode,
  Supplier,
  TestOrderModel,
  UUID,
} from "../models/TestOrder";
import { BaseDbClient } from "./BaseDbClient";

export class TestOrderDbClient extends BaseDbClient {
  async getOrderByUid(orderUid: UUID): Promise<TestOrderModel | undefined> {
    const rows = await this.query<TestOrderModel>(
      `SELECT t.order_uid, t.order_reference, t.supplier_id, t.patient_uid,
              t.test_code, t.originator, t.created_at,
              s.supplier_name, p.nhs_number, p.birth_date
       FROM test_order t
       JOIN supplier s ON s.supplier_id = t.supplier_id
       JOIN patient_mapping p ON p.patient_uid = t.patient_uid
       WHERE t.order_uid = $1::uuid`,
      [orderUid],
    );
    return rows[0];
  }

  async getSupplierIdByName(supplierName: string): Promise<UUID> {
    const rows = await this.query<Supplier>(
      `SELECT supplier_id FROM supplier
       WHERE supplier_name = $1 LIMIT 1`,
      [supplierName],
    );
    return rows[0].supplier_id;
  }

  async getTestCodeByDescription(testDescription: string): Promise<string> {
    const rows = await this.query<{ test_code: string }>(
      `SELECT test_code
       FROM test_type
       WHERE description = $1
       LIMIT 1`,
      [testDescription],
    );
    return rows[0].test_code;
  }

  async upsertPatient(nhsNumber: string, birthDate: string): Promise<UUID> {
    const rows = await this.query<{ patient_uid: UUID }>(
      `INSERT INTO patient_mapping (nhs_number, birth_date)
       VALUES ($1, $2::date)
       ON CONFLICT (nhs_number) DO UPDATE SET birth_date = EXCLUDED.birth_date
       RETURNING patient_uid`,
      [nhsNumber, birthDate],
    );
    return rows[0].patient_uid;
  }

  async createTestOrder(
    supplierId: UUID,
    patientUid: UUID,
    testCode: string,
    originator = "automatic-test",
  ): Promise<{ order_uid: UUID; order_reference: number }> {
    const rows = await this.query<TestOrderModel>(
      `INSERT INTO test_order (supplier_id, patient_uid, test_code, originator)
       VALUES ($1::uuid, $2::uuid, $3, $4)
       RETURNING order_uid, order_reference`,
      [supplierId, patientUid, testCode, originator],
    );
    return {
      order_uid: rows[0].order_uid,
      order_reference: rows[0].order_reference,
    };
  }

  async insertOrderStatus(orderUid: UUID, statusCode: OrderStatusCode): Promise<void> {
    await this.query(
      `INSERT INTO order_status (order_uid, status_code)
       VALUES ($1::uuid, $2)`,
      [orderUid, statusCode],
    );
  }

  async updateOrderStatus(orderUid: UUID, statusCode: OrderStatusCode): Promise<void> {
    await this.query(`UPDATE order_status SET status_code = $2 WHERE order_uid = $1::uuid`, [
      orderUid,
      statusCode,
    ]);
  }

  async insertConsent(orderUid: UUID): Promise<void> {
    await this.query(
      `INSERT INTO consent (order_uid)
       VALUES ($1::uuid)`,
      [orderUid],
    );
  }

  async createOrderWithPatientAndStatus(
    input: CreateOrderInput,
  ): Promise<{ order_uid: UUID; patient_uid: UUID; order_reference: number }> {
    const patient_uid = await this.upsertPatient(input.nhs_number, input.birth_date);
    const supplier_id = await this.getSupplierIdByName(input.supplier_name);
    const order = await this.createTestOrder(
      supplier_id,
      patient_uid,
      input.test_code,
      input.originator,
    );
    await this.insertOrderStatus(order.order_uid, input.initial_status);
    await this.insertConsent(order.order_uid);
    return { order_uid: order.order_uid, patient_uid, order_reference: order.order_reference };
  }

  async deleteOrderStatusByUid(orderUid: UUID): Promise<void> {
    await this.query(`DELETE FROM order_status WHERE order_uid = $1::uuid`, [orderUid]);
  }

  async deleteOrderByPatientUid(patientUid: UUID): Promise<void> {
    await this.query(`DELETE FROM test_order WHERE patient_uid = $1::uuid`, [patientUid]);
  }

  async getPatientUidByNhsNumber(nhsNumber: string): Promise<UUID | undefined> {
    const rows = await this.query<{ patient_uid: UUID }>(
      `SELECT patient_uid FROM patient_mapping WHERE nhs_number = $1 LIMIT 1`,
      [nhsNumber],
    );
    return rows[0]?.patient_uid;
  }

  async deleteOrderStatusByPatientUid(patientUid: UUID): Promise<void> {
    await this.query(
      `DELETE FROM order_status WHERE order_uid IN (
         SELECT order_uid FROM test_order WHERE patient_uid = $1::uuid
       )`,
      [patientUid],
    );
  }

  async deletePatientMapping(nhsNumber: string, birthDate: string): Promise<void> {
    await this.query(
      `DELETE FROM patient_mapping
       WHERE nhs_number = $1 AND birth_date = $2::date`,
      [nhsNumber, birthDate],
    );
  }

  async deleteConsentByOrderUid(orderUid: UUID): Promise<void> {
    await this.query(`DELETE FROM consent WHERE order_uid = $1::uuid`, [orderUid]);
  }

  async deleteConsentByPatientUid(patientUid: UUID): Promise<void> {
    await this.query(
      `DELETE FROM consent WHERE order_uid IN (
         SELECT order_uid FROM test_order WHERE patient_uid = $1::uuid
       )`,
      [patientUid],
    );
  }

  async deleteOrderByUid(orderUid: UUID): Promise<void> {
    await this.query(`DELETE FROM test_order WHERE order_uid = $1::uuid`, [orderUid]);
  }

  async deleteOrderCascade(orderUid: UUID): Promise<void> {
    await this.query(`DELETE FROM consent WHERE order_uid = $1::uuid`, [orderUid]);
    await this.query(`DELETE FROM test_order WHERE order_uid = $1::uuid`, [orderUid]);
  }

  async deleteOrdersByPatientCascade(patientUid: UUID): Promise<void> {
    await this.query(
      `DELETE FROM consent WHERE order_uid IN (
         SELECT order_uid FROM test_order WHERE patient_uid = $1::uuid
       )`,
      [patientUid],
    );
    await this.query(`DELETE FROM test_order WHERE patient_uid = $1::uuid`, [patientUid]);
  }

  async getOrderStatusesByOrderUid(
    orderUid: string,
  ): Promise<{ status_code: string }[] | undefined> {
    const rows = await this.query<{ status_code: string }>(
      `
      SELECT status_code
      FROM order_status
      WHERE order_uid = $1::uuid
      ORDER BY created_at DESC
      LIMIT 5
    `,
      [orderUid],
    );

    return rows;
  }

  async getLatestOrderStatusWithCountByOrderUid(
    orderUid: UUID,
  ): Promise<{ statusCode: OrderStatusCode; count: number }> {
    const rows = await this.query<{ status_code: string; count: string }>(
      `SELECT status_code, COUNT(*) OVER() as count
       FROM order_status
       WHERE order_uid = $1::uuid
       ORDER BY created_at DESC
       LIMIT 1`,
      [orderUid],
    );
    return {
      statusCode: rows[0].status_code as OrderStatusCode,
      count: Number(rows[0].count),
    };
  }

  async getOrderStatusCountByCode(orderUid: UUID, statusCode: OrderStatusCode): Promise<number> {
    const rows = await this.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM order_status
       WHERE order_uid = $1::uuid
         AND status_code = $2`,
      [orderUid, statusCode],
    );
    return Number(rows[0].count);
  }

  async hasOrderStatusCode(orderUid: UUID, statusCode: OrderStatusCode): Promise<boolean> {
    return (await this.getOrderStatusCountByCode(orderUid, statusCode)) > 0;
  }

  async getOrderByPatientUid(patientUid: UUID): Promise<TestOrderModel | undefined> {
    const rows = await this.query<TestOrderModel>(
      `SELECT t.order_uid, t.order_reference, t.supplier_id, t.patient_uid,
              t.test_code, t.originator, t.created_at,
              s.supplier_name, p.nhs_number, p.birth_date
       FROM test_order t
       JOIN supplier s ON s.supplier_id = t.supplier_id
       JOIN patient_mapping p ON p.patient_uid = t.patient_uid
       WHERE t.patient_uid = $1::uuid
       ORDER BY t.created_at DESC
       LIMIT 1`,
      [patientUid],
    );
    return rows[0];
  }
}
