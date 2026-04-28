import { randomUUID } from "crypto";

import { APIResponse, expect } from "@playwright/test";

import type { TestOrderDbClient } from "../../db/TestOrderDbClient";
import { test } from "../../fixtures/CombinedTestFixture";
import { AddressModel } from "../../models/Address";
import { OrderStatusTestData } from "../../test-data/OrderStatusTypes";
import { ResultsObservationData } from "../../test-data/ResultsObservationData";
import { buildHeaders, headersTestResults, orderStatusPayload } from "../../utils/ApiRequestHelper";

const randomAddress = AddressModel.getRandomAddress();

const EXPECTED_TEXTS = {
  HIV_KIT_HEADER: "Order a free HIV self-test kit",
  BLOOD_SAMPLE_HEADER: "This is what you'll need to do to give a blood sample",
  ORDER_SUBMITTED: "Order submitted",
  DISPATCHED: "Dispatched",
  TEST_RECEIVED: "Test received",
  HIV_RESULT_HEADER: "HIV self-test result",
  NEGATIVE_RESULT: "Negative",
} as const;

const ORDER_STATUS_POLL_TIMEOUT = 20000;

interface OrderData {
  orderId: string;
  patientId: string;
  supplierId: string;
}

test.describe("Home test E2E tests", { tag: ["@e2e", "@db"] }, () => {
  async function completeOrderJourney(context: {
    beforeYouStartPage: any;
    getSelfTestKitPage: any;
    enterDeliveryAddressPage: any;
    selectDeliveryAddressPage: any;
    howComfortablePrickingFingerPage: any;
    confirmMobileNumberPage: any;
    checkYourAnswersPage: any;
    orderSubmittedPage: any;
  }): Promise<void> {
    await context.beforeYouStartPage.navigate();
    await context.beforeYouStartPage.clickContinueToOrderKitButton();
    await expect(context.getSelfTestKitPage.headerText).toHaveText(EXPECTED_TEXTS.HIV_KIT_HEADER);
    await context.getSelfTestKitPage.clickStartNowButton();
    await context.enterDeliveryAddressPage.fillPostCodeAndAddressAndContinue(randomAddress);
    await context.selectDeliveryAddressPage.selectAddressAndContinue();
    await expect(context.getSelfTestKitPage.headerText).toHaveText(
      EXPECTED_TEXTS.BLOOD_SAMPLE_HEADER,
    );
    await context.howComfortablePrickingFingerPage.selectYesOptionAndContinue();
    await context.confirmMobileNumberPage.selectConfirmMobileNumberAndContinue();
    await context.checkYourAnswersPage.checkConsentCheckbox();
    await context.checkYourAnswersPage.clickSubmitOrder();
    await expect(context.orderSubmittedPage.headerText).toHaveText(EXPECTED_TEXTS.ORDER_SUBMITTED);
  }

  async function getOrderData(
    testOrderDb: TestOrderDbClient,
    nhsNumber: string,
  ): Promise<OrderData> {
    const patientId = await testOrderDb.getPatientUidByNhsNumber(nhsNumber);
    const order = await testOrderDb.getOrderByPatientUid(patientId!);

    await expect
      .poll(() => testOrderDb.hasOrderStatusCode(order!.order_uid, "SUBMITTED"), {
        timeout: ORDER_STATUS_POLL_TIMEOUT,
      })
      .toBe(true);

    return {
      orderId: order!.order_uid,
      patientId: patientId!,
      supplierId: order!.supplier_id,
    };
  }

  async function updateOrderStatusAndVerify(
    orderStatusApi: any,
    orderStatusPage: any,
    orderData: OrderData,
    businessStatusText: string,
    expectedDisplayStatus: string,
  ): Promise<void> {
    const response = await orderStatusApi.updateOrderStatus(
      orderStatusPayload(
        orderData.orderId,
        orderData.patientId,
        OrderStatusTestData.DEFAULT_STATUS,
        OrderStatusTestData.DEFAULT_INTENT,
        { businessStatus: { text: businessStatusText } },
      ),
      buildHeaders(randomUUID()),
    );
    orderStatusApi.validateResponse(response, 201);

    await orderStatusPage.navigateToOrder(orderData.orderId);
    await expect(orderStatusPage.statusTag).toHaveText(expectedDisplayStatus);
  }

  async function submitTestResults(
    hivResultsApi: any,
    orderData: OrderData,
    isNormal: boolean,
  ): Promise<APIResponse> {
    const observation = isNormal
      ? ResultsObservationData.buildNormalObservation(
          orderData.orderId,
          orderData.patientId,
          orderData.supplierId,
        )
      : ResultsObservationData.buildAbnormalObservation(
          orderData.orderId,
          orderData.patientId,
          orderData.supplierId,
        );

    return await hivResultsApi.submitTestResults(observation, headersTestResults(randomUUID()));
  }

  test.afterEach(async ({ testedUser, testOrderDb }) => {
    const patientId = await testOrderDb.getPatientUidByNhsNumber(testedUser.nhsNumber!);
    if (patientId) {
      await testOrderDb.deleteOrdersByPatientCascade(patientId);
    }
    await testOrderDb.deletePatientMapping(testedUser.nhsNumber!, testedUser.dob!);
  });

  test(
    "E2E - Full HIV Test user journey - normal result",
    { tag: ["@ui", "@e2e"] },
    async ({
      testedUser,
      orderStatusApi,
      hivResultsApi,
      negativeResultPage,
      beforeYouStartPage,
      getSelfTestKitPage,
      enterDeliveryAddressPage,
      selectDeliveryAddressPage,
      howComfortablePrickingFingerPage,
      confirmMobileNumberPage,
      checkYourAnswersPage,
      orderSubmittedPage,
      orderStatusPage,
      testOrderDb,
    }) => {
      await completeOrderJourney({
        beforeYouStartPage,
        getSelfTestKitPage,
        enterDeliveryAddressPage,
        selectDeliveryAddressPage,
        howComfortablePrickingFingerPage,
        confirmMobileNumberPage,
        checkYourAnswersPage,
        orderSubmittedPage,
      });

      const orderData = await getOrderData(testOrderDb, testedUser.nhsNumber!);

      await updateOrderStatusAndVerify(
        orderStatusApi,
        orderStatusPage,
        orderData,
        OrderStatusTestData.BUSINESS_STATUS_DISPATCHED,
        EXPECTED_TEXTS.DISPATCHED,
      );

      await updateOrderStatusAndVerify(
        orderStatusApi,
        orderStatusPage,
        orderData,
        OrderStatusTestData.BUSINESS_STATUS_RECEIVED_AT_LAB,
        EXPECTED_TEXTS.TEST_RECEIVED,
      );

      const resultsResponse = await submitTestResults(hivResultsApi, orderData, true);
      expect(resultsResponse.status()).toBe(201);

      await negativeResultPage.navigateToOrderResult(orderData.orderId);
      await expect(negativeResultPage.pageHeader).toHaveText(EXPECTED_TEXTS.HIV_RESULT_HEADER);
      await expect(negativeResultPage.result).toHaveText(EXPECTED_TEXTS.NEGATIVE_RESULT);
    },
  );

  test(
    "E2E - Full HIV Test user journey - abnormal result",
    { tag: ["@ui", "@e2e"] },
    async ({
      testedUser,
      orderStatusApi,
      hivResultsApi,
      beforeYouStartPage,
      negativeResultPage,
      orderStatusPage,
      getSelfTestKitPage,
      enterDeliveryAddressPage,
      selectDeliveryAddressPage,
      howComfortablePrickingFingerPage,
      confirmMobileNumberPage,
      checkYourAnswersPage,
      orderSubmittedPage,
      testOrderDb,
    }) => {
      await completeOrderJourney({
        beforeYouStartPage,
        getSelfTestKitPage,
        enterDeliveryAddressPage,
        selectDeliveryAddressPage,
        howComfortablePrickingFingerPage,
        confirmMobileNumberPage,
        checkYourAnswersPage,
        orderSubmittedPage,
      });

      const orderData = await getOrderData(testOrderDb, testedUser.nhsNumber!);

      await updateOrderStatusAndVerify(
        orderStatusApi,
        orderStatusPage,
        orderData,
        OrderStatusTestData.BUSINESS_STATUS_DISPATCHED,
        EXPECTED_TEXTS.DISPATCHED,
      );

      await updateOrderStatusAndVerify(
        orderStatusApi,
        orderStatusPage,
        orderData,
        OrderStatusTestData.BUSINESS_STATUS_RECEIVED_AT_LAB,
        EXPECTED_TEXTS.TEST_RECEIVED,
      );

      const resultsResponse = await submitTestResults(hivResultsApi, orderData, false);
      expect(resultsResponse.status()).toBe(201);

      await negativeResultPage.navigateToOrderResultExpectingPath(
        orderData.orderId,
        orderStatusPage.statusTag,
        `/orders/${orderData.orderId}/tracking`,
      );
      await expect(orderStatusPage.statusTag).toHaveText(EXPECTED_TEXTS.TEST_RECEIVED);
    },
  );
});
