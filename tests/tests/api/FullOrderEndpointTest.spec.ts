import { randomUUID } from "node:crypto";

import { expect } from "@playwright/test";

import type { HIVResultsApiResource } from "../../api/clients/HIVResultsApiResource";
import type { OrderApiResource } from "../../api/clients/OrderApiResource";
import type { TestResultDbClient } from "../../db/TestResultDbClient";
import { test } from "../../fixtures/CombinedTestFixture";
import { CreateOrderResponseModel } from "../../models/CreateOrderResponse";
import type { OrderStatusCode } from "../../models/TestOrder";
import {
  createGetResultHeaders,
  createGetResultParams,
} from "../../test-data/GetResultRequestParams";
import { OrderStatusTestData } from "../../test-data/OrderStatusTypes";
import { OrderTestData } from "../../test-data/OrderTestData";
import { ResultsObservationData } from "../../test-data/ResultsObservationData";
import {
  buildHeaders,
  createHeaders,
  headersTestResults,
  orderStatusPayload,
} from "../../utils/ApiRequestHelper";

let orderId: string;
let patientId: string;
const supplierId = OrderTestData.PREVENTX_SUPPLIER_ID;
const POLL_TIMEOUT_MS = 15000;

async function waitForOrderStatus(
  orderApi: OrderApiResource,
  nhsNumber: string,
  dob: string,
  orderId: string,
  expectedStatus: OrderStatusCode,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const statusResponse = await orderApi.getOrder(nhsNumber, dob, orderId);
        if (statusResponse.status() !== 200) {
          return `http-${statusResponse.status()}`;
        }

        return orderApi.extractOrderStatus(await statusResponse.json());
      },
      { timeout: POLL_TIMEOUT_MS },
    )
    .toBe(expectedStatus);
}

async function waitForResultResponseStatus(
  hivResultsApi: HIVResultsApiResource,
  nhsNumber: string,
  dob: string,
  orderId: string,
  correlationId: string,
  expectedStatus: number,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const resultResponse = await hivResultsApi.getResult(
          createGetResultParams(nhsNumber, dob, orderId),
          createGetResultHeaders(correlationId),
        );

        return resultResponse.status();
      },
      { timeout: POLL_TIMEOUT_MS },
    )
    .toBe(expectedStatus);
}

async function waitForResultStatusCount(
  testResultDb: TestResultDbClient,
  orderId: string,
  expectedCount: number,
): Promise<void> {
  await expect
    .poll(async () => testResultDb.getResultStatusCountByOrderUid(orderId), {
      timeout: POLL_TIMEOUT_MS,
    })
    .toBe(expectedCount);
}

test.describe("Full Order E2E API", { tag: ["@API", "@db"] }, () => {
  test.beforeEach("Create an order via API", async ({ testedUser, orderApi, testOrderDb }) => {
    const payload = OrderTestData.getDefaultOrder();
    payload.patient.nhsNumber = testedUser.nhsNumber!;
    payload.patient.birthDate = testedUser.dob!;

    const orderResponse = await orderApi.createOrder(
      payload,
      createHeaders("application/json", randomUUID()),
    );
    expect(orderResponse.status()).toBe(201);

    const orderBody = CreateOrderResponseModel.fromJson(await orderResponse.json());

    orderId = orderBody.orderUid;

    patientId = (await testOrderDb.getPatientUidByNhsNumber(testedUser.nhsNumber!))!;

    await expect
      .poll(async () => (await testOrderDb.getOrderStatusesByOrderUid(orderId))?.length, {
        timeout: 20000,
      })
      .toBe(3);
  });

  test("should set order status to COMPLETE and make result available when test result is normal", async ({
    hivResultsApi,
    orderApi,
    orderStatusApi,
    testedUser,
    testOrderDb,
    testResultDb,
  }) => {
    const dispatchedResponse = await orderStatusApi.updateOrderStatus(
      orderStatusPayload(
        orderId,
        patientId,
        OrderStatusTestData.DEFAULT_STATUS,
        OrderStatusTestData.DEFAULT_INTENT,
        {
          businessStatus: { text: OrderStatusTestData.BUSINESS_STATUS_DISPATCHED },
        },
      ),
      buildHeaders(randomUUID()),
    );
    orderStatusApi.validateResponse(dispatchedResponse, 201);

    const { statusCode: dispatchedStatusCode } =
      await testOrderDb.getLatestOrderStatusWithCountByOrderUid(orderId);
    expect(dispatchedStatusCode).toBe(OrderStatusTestData.EXPECTED_STATUS_CODE_DISPATCHED);
    expect(
      await testOrderDb.getOrderStatusCountByCode(
        orderId,
        OrderStatusTestData.EXPECTED_STATUS_CODE_DISPATCHED,
      ),
    ).toBe(1);

    const receivedResponse = await orderStatusApi.updateOrderStatus(
      orderStatusPayload(
        orderId,
        patientId,
        OrderStatusTestData.DEFAULT_STATUS,
        OrderStatusTestData.DEFAULT_INTENT,
        {
          businessStatus: { text: OrderStatusTestData.BUSINESS_STATUS_RECEIVED_AT_LAB },
        },
      ),
      buildHeaders(randomUUID()),
    );
    orderStatusApi.validateResponse(receivedResponse, 201);

    const { statusCode: receivedStatusCode } =
      await testOrderDb.getLatestOrderStatusWithCountByOrderUid(orderId);
    expect(receivedStatusCode).toBe(OrderStatusTestData.EXPECTED_STATUS_CODE_RECEIVED);
    expect(
      await testOrderDb.getOrderStatusCountByCode(
        orderId,
        OrderStatusTestData.EXPECTED_STATUS_CODE_RECEIVED,
      ),
    ).toBe(1);

    const testData = ResultsObservationData.buildNormalObservation(orderId, patientId, supplierId);
    const response = await hivResultsApi.submitTestResults(
      testData,
      headersTestResults(randomUUID()),
    );
    expect(response.status()).toBe(201);

    await waitForOrderStatus(orderApi, testedUser.nhsNumber!, testedUser.dob!, orderId, "COMPLETE");

    await waitForResultResponseStatus(
      hivResultsApi,
      testedUser.nhsNumber!,
      testedUser.dob!,
      orderId,
      randomUUID(),
      200,
    );

    const resultResponse = await hivResultsApi.getResult(
      createGetResultParams(testedUser.nhsNumber!, testedUser.dob!, orderId),
      createGetResultHeaders(randomUUID()),
    );
    hivResultsApi.validateStatus(resultResponse, 200);
    const resultBody = (await resultResponse.json()) as {
      interpretation: Array<{ coding: Array<{ display: string }> }>;
    };

    expect(resultBody.interpretation).toHaveLength(1);
    expect(resultBody.interpretation[0].coding[0].display).toBe("Normal");

    await waitForResultStatusCount(testResultDb, orderId, 1);
  });

  test("should set order status to RECEIVED and withhold result when test result is abnormal", async ({
    hivResultsApi,
    orderApi,
    orderStatusApi,
    testedUser,
    testOrderDb,
    testResultDb,
  }) => {
    const dispatchedResponse = await orderStatusApi.updateOrderStatus(
      orderStatusPayload(
        orderId,
        patientId,
        OrderStatusTestData.DEFAULT_STATUS,
        OrderStatusTestData.DEFAULT_INTENT,
        {
          businessStatus: { text: OrderStatusTestData.BUSINESS_STATUS_DISPATCHED },
        },
      ),
      buildHeaders(randomUUID()),
    );
    orderStatusApi.validateResponse(dispatchedResponse, 201);

    const { statusCode: dispatchedStatusCode } =
      await testOrderDb.getLatestOrderStatusWithCountByOrderUid(orderId);
    expect(dispatchedStatusCode).toBe(OrderStatusTestData.EXPECTED_STATUS_CODE_DISPATCHED);
    expect(
      await testOrderDb.getOrderStatusCountByCode(
        orderId,
        OrderStatusTestData.EXPECTED_STATUS_CODE_DISPATCHED,
      ),
    ).toBe(1);

    const receivedResponse = await orderStatusApi.updateOrderStatus(
      orderStatusPayload(
        orderId,
        patientId,
        OrderStatusTestData.DEFAULT_STATUS,
        OrderStatusTestData.DEFAULT_INTENT,
        {
          businessStatus: { text: OrderStatusTestData.BUSINESS_STATUS_RECEIVED_AT_LAB },
        },
      ),
      buildHeaders(randomUUID()),
    );
    orderStatusApi.validateResponse(receivedResponse, 201);

    const { statusCode: receivedStatusCode } =
      await testOrderDb.getLatestOrderStatusWithCountByOrderUid(orderId);
    expect(receivedStatusCode).toBe(OrderStatusTestData.EXPECTED_STATUS_CODE_RECEIVED);
    expect(
      await testOrderDb.getOrderStatusCountByCode(
        orderId,
        OrderStatusTestData.EXPECTED_STATUS_CODE_RECEIVED,
      ),
    ).toBe(1);

    const testData = ResultsObservationData.buildAbnormalObservation(
      orderId,
      patientId,
      supplierId,
    );
    const response = await hivResultsApi.submitTestResults(
      testData,
      headersTestResults(randomUUID()),
    );
    expect(response.status()).toBe(201);

    await waitForOrderStatus(orderApi, testedUser.nhsNumber!, testedUser.dob!, orderId, "RECEIVED");

    await waitForResultStatusCount(testResultDb, orderId, 1);

    await waitForResultResponseStatus(
      hivResultsApi,
      testedUser.nhsNumber!,
      testedUser.dob!,
      orderId,
      randomUUID(),
      404,
    );
  });

  test.afterEach(
    "Delete order, patient, and dependent records from the database",
    async ({ testedUser, testOrderDb }) => {
      await testOrderDb.deleteOrderCascade(orderId);
      await testOrderDb.deletePatientMapping(testedUser.nhsNumber!, testedUser.dob!);
    },
  );
});
