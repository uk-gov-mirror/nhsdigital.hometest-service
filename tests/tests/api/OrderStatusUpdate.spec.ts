import { randomUUID } from "crypto";

import { expect, test } from "../../fixtures/IntegrationFixture";
import { OrderStatusTestData } from "../../test-data/OrderStatusTypes";
import { OrderTestData } from "../../test-data/OrderTestData";
import { RandomDataGenerator, buildHeaders, orderStatusPayload } from "../../utils";

const originator = OrderStatusTestData.DEFAULT_ORIGINATOR;
const defaultStatus = OrderStatusTestData.DEFAULT_STATUS;
const defaultIntent = OrderStatusTestData.DEFAULT_INTENT;

test.describe("Order Status Update API", { tag: ["@API", "@db"] }, () => {
  let orderUid: string;
  let patientUid: string;
  let nhsNumber: string;
  let birthDate: string;

  test.beforeEach(async ({ testOrderDb }) => {
    nhsNumber = RandomDataGenerator.generateNhsNumber();
    birthDate = RandomDataGenerator.generateBirthDate();

    const supplierId = await testOrderDb.getSupplierIdByName(OrderTestData.PREVENTX_SUPPLIER_NAME);
    const testCode = await testOrderDb.getTestCodeByDescription(
      OrderTestData.defaultOrder.testDescription,
    );

    patientUid = await testOrderDb.upsertPatient(nhsNumber, birthDate);
    const orderResult = await testOrderDb.createTestOrder(
      supplierId,
      patientUid,
      testCode,
      originator,
    );
    orderUid = orderResult.order_uid;
    await testOrderDb.insertConsent(orderUid);
  });

  test.afterEach(async ({ testOrderDb }) => {
    await testOrderDb.deleteOrderStatusByUid(orderUid);
    await testOrderDb.deleteConsentByOrderUid(orderUid);
    await testOrderDb.deleteOrderByUid(orderUid);
    await testOrderDb.deletePatientMapping(nhsNumber, birthDate);
  });

  test(
    "success (201) persists order status updates",
    { tag: ["@API"] },
    async ({ orderStatusApi, testOrderDb }) => {
      const confirmedResponse = await orderStatusApi.updateOrderStatus(
        orderStatusPayload(orderUid, patientUid, defaultStatus, defaultIntent, {
          businessStatus: { text: OrderStatusTestData.BUSINESS_STATUS_ORDER_ACCEPTED },
        }),
        buildHeaders(randomUUID()),
      );

      orderStatusApi.validateResponse(confirmedResponse, 201);

      const { statusCode: confirmedStatusCode } =
        await testOrderDb.getLatestOrderStatusWithCountByOrderUid(orderUid);
      expect(confirmedStatusCode).toBe(OrderStatusTestData.EXPECTED_STATUS_CODE_CONFIRMED);

      const dispatchedResponse = await orderStatusApi.updateOrderStatus(
        orderStatusPayload(orderUid, patientUid, defaultStatus, defaultIntent, {
          businessStatus: { text: OrderStatusTestData.BUSINESS_STATUS_DISPATCHED },
        }),
        buildHeaders(randomUUID()),
      );

      orderStatusApi.validateResponse(dispatchedResponse, 201);

      const { statusCode: dispatchedStatusCode } =
        await testOrderDb.getLatestOrderStatusWithCountByOrderUid(orderUid);
      expect(dispatchedStatusCode).toBe(OrderStatusTestData.EXPECTED_STATUS_CODE_DISPATCHED);

      const receivedResponse = await orderStatusApi.updateOrderStatus(
        orderStatusPayload(orderUid, patientUid, defaultStatus, defaultIntent, {
          businessStatus: { text: OrderStatusTestData.BUSINESS_STATUS_RECEIVED_AT_LAB },
        }),
        buildHeaders(randomUUID()),
      );

      orderStatusApi.validateResponse(receivedResponse, 201);

      const { statusCode: receivedStatusCode } =
        await testOrderDb.getLatestOrderStatusWithCountByOrderUid(orderUid);
      expect(receivedStatusCode).toBe(OrderStatusTestData.EXPECTED_STATUS_CODE_RECEIVED);
    },
  );
});
