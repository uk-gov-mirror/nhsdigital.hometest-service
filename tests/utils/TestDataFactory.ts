import { TestOrderDbClient } from "../db/TestOrderDbClient";
import { OrderStatusCode, UUID } from "../models/TestOrder";
import { OrderStatusTestData } from "../test-data/OrderStatusTypes";
import { OrderTestData } from "../test-data/OrderTestData";
import { RandomDataGenerator } from "./RandomDataGenerator";

export interface CreateOrderOptions {
  supplierName?: string;
  testDescription?: string;
  originator?: string;
  initialStatus?: OrderStatusCode;
  withConsent?: boolean;
}

export interface CreateOrderForNewPatientOptions extends CreateOrderOptions {
  nhsNumber?: string;
  birthDate?: string;
}

export interface CreatedPatient {
  patientUid: UUID;
  nhsNumber: string;
  birthDate: string;
}

export interface CreatedOrder {
  orderUid: UUID;
  orderReference: number;
}

export interface CreatedOrderForPatient extends CreatedOrder, CreatedPatient {}

/**
 * Creates test data on demand and tracks it for automatic cleanup at the end
 * of a test. Usage via the `testData` fixture — never instantiate directly.
 *
 * Cleanup deletes orders (cascading status/reminders/results) and the
 * patients created via this factory in reverse insertion order.
 */
export class TestDataFactory {
  private readonly orderUids: UUID[] = [];
  private readonly patients: CreatedPatient[] = [];

  constructor(private readonly db: TestOrderDbClient) {}

  async createPatient(nhsNumber?: string, birthDate?: string): Promise<CreatedPatient> {
    const nhs = nhsNumber ?? RandomDataGenerator.generateNhsNumber();
    const dob = birthDate ?? RandomDataGenerator.generateBirthDate();
    const patientUid = await this.db.upsertPatient(nhs, dob);
    const patient = { patientUid, nhsNumber: nhs, birthDate: dob };
    this.patients.push(patient);
    return patient;
  }

  async createOrderForPatient(
    patientUid: UUID,
    options: CreateOrderOptions = {},
  ): Promise<CreatedOrder> {
    const supplierId = await this.db.getSupplierIdByName(
      options.supplierName ?? OrderTestData.PREVENTX_SUPPLIER_NAME,
    );
    const testCode = await this.db.getTestCodeByDescription(
      options.testDescription ?? OrderTestData.defaultOrder.testDescription,
    );
    const order = await this.db.createTestOrder(
      supplierId,
      patientUid,
      testCode,
      options.originator ?? OrderStatusTestData.DEFAULT_ORIGINATOR,
    );
    this.orderUids.push(order.order_uid);

    if (options.initialStatus) {
      await this.db.insertOrderStatus(order.order_uid, options.initialStatus);
    }
    if (options.withConsent !== false) {
      await this.db.insertConsent(order.order_uid);
    }

    return { orderUid: order.order_uid, orderReference: order.order_reference };
  }

  async createOrderForNewPatient(
    options: CreateOrderForNewPatientOptions = {},
  ): Promise<CreatedOrderForPatient> {
    const patient = await this.createPatient(options.nhsNumber, options.birthDate);
    const order = await this.createOrderForPatient(patient.patientUid, options);
    return { ...patient, ...order };
  }

  async cleanup(): Promise<void> {
    for (const orderUid of [...this.orderUids].reverse()) {
      await this.db.deleteOrderCascade(orderUid);
    }
    for (const { nhsNumber, birthDate } of [...this.patients].reverse()) {
      await this.db.deletePatientMapping(nhsNumber, birthDate);
    }
    this.orderUids.length = 0;
    this.patients.length = 0;
  }
}
