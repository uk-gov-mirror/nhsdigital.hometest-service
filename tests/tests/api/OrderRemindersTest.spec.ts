import { randomUUID } from "crypto";

import { expect, test } from "../../fixtures/IntegrationFixture";
import { isValidReminder } from "../../models/TestReminder";
import { OrderStatusTestData } from "../../test-data/OrderStatusTypes";
import { buildHeaders, orderStatusPayload } from "../../utils";

const defaultStatus = OrderStatusTestData.DEFAULT_STATUS;
const defaultIntent = OrderStatusTestData.DEFAULT_INTENT;

test.describe("Order Reminders", { tag: ["@API", "@db"] }, () => {
  let orderUid: string;
  let secondOrderUid: string;
  let patientUid: string;

  test.beforeEach(async ({ testData }) => {
    const first = await testData.createOrderForNewPatient();
    orderUid = first.orderUid;
    patientUid = first.patientUid;

    const second = await testData.createOrderForPatient(patientUid);
    secondOrderUid = second.orderUid;
  });

  test(
    "should create reminders with correct status and update them when dispatched",
    { tag: ["@API"] },
    async ({ orderStatusApi, testRemindersDb, lambdaInvoker }) => {
      await orderStatusApi.updateOrderStatus(
        orderStatusPayload(orderUid, patientUid, defaultStatus, defaultIntent, {
          businessStatus: { text: OrderStatusTestData.BUSINESS_STATUS_DISPATCHED },
        }),
        buildHeaders(randomUUID()),
      );

      const remindersCount = await testRemindersDb.getRemindersCountByOrderUid(orderUid);
      expect(remindersCount).toBe(1);
      const reminderStatus = await testRemindersDb.getReminderStatusByOrderUidAndReminderNumber(
        orderUid,
        1,
      );
      expect(reminderStatus).toBe("SCHEDULED");

      await testRemindersDb.updateReminderTriggeredAt(orderUid, 1, 7);
      await lambdaInvoker.invokeReminderDispatch();

      const remindersCountAfter = await testRemindersDb.getRemindersCountByOrderUid(orderUid);
      expect(remindersCountAfter).toBe(2);
      expect(await testRemindersDb.getReminderStatusByOrderUidAndReminderNumber(orderUid, 1)).toBe(
        "QUEUED",
      );
      const secondReminderStatus =
        await testRemindersDb.getReminderStatusByOrderUidAndReminderNumber(orderUid, 2);
      expect(secondReminderStatus).toBe("SCHEDULED");

      await testRemindersDb.updateReminderTriggeredAt(orderUid, 2, 15);
      await lambdaInvoker.invokeReminderDispatch();

      const remindersCountAfterSecond = await testRemindersDb.getRemindersCountByOrderUid(orderUid);
      expect(remindersCountAfterSecond).toBe(3);
      expect(await testRemindersDb.getReminderStatusByOrderUidAndReminderNumber(orderUid, 2)).toBe(
        "QUEUED",
      );
      const thirdReminderStatus =
        await testRemindersDb.getReminderStatusByOrderUidAndReminderNumber(orderUid, 3);
      expect(thirdReminderStatus).toBe("SCHEDULED");

      await testRemindersDb.updateReminderTriggeredAt(orderUid, 3, 30);
      await lambdaInvoker.invokeReminderDispatch();

      const remindersCountAfterThird = await testRemindersDb.getRemindersCountByOrderUid(orderUid);
      expect(remindersCountAfterThird).toBe(3);
      expect(await testRemindersDb.getReminderStatusByOrderUidAndReminderNumber(orderUid, 3)).toBe(
        "QUEUED",
      );

      await testRemindersDb.updateReminderTriggeredAt(orderUid, 1, 45);
      await lambdaInvoker.invokeReminderDispatch();

      const remindersCountAfterFourth = await testRemindersDb.getRemindersCountByOrderUid(orderUid);
      expect(remindersCountAfterFourth).toBe(3);

      const reminders = await testRemindersDb.getRemindersByOrderUid(orderUid);
      expect(reminders.every(isValidReminder)).toBe(true);
    },
  );

  test(
    "should cancel scheduled reminders when order status changes to received",
    { tag: ["@API"] },
    async ({ orderStatusApi, testRemindersDb, lambdaInvoker }) => {
      await orderStatusApi.updateOrderStatus(
        orderStatusPayload(secondOrderUid, patientUid, defaultStatus, defaultIntent, {
          businessStatus: { text: OrderStatusTestData.BUSINESS_STATUS_DISPATCHED },
        }),
        buildHeaders(randomUUID()),
      );

      await testRemindersDb.updateReminderTriggeredAt(secondOrderUid, 1, 7);
      await lambdaInvoker.invokeReminderDispatch();

      await orderStatusApi.updateOrderStatus(
        orderStatusPayload(secondOrderUid, patientUid, defaultStatus, defaultIntent, {
          businessStatus: { text: OrderStatusTestData.BUSINESS_STATUS_RECEIVED_AT_LAB },
        }),
        buildHeaders(randomUUID()),
      );
      await lambdaInvoker.invokeReminderDispatch();

      const remindersCountAfter = await testRemindersDb.getRemindersCountByOrderUid(secondOrderUid);
      expect(remindersCountAfter).toBe(2);
      expect(
        await testRemindersDb.getReminderStatusByOrderUidAndReminderNumber(secondOrderUid, 1),
      ).toBe("QUEUED");
      const secondReminderStatus =
        await testRemindersDb.getReminderStatusByOrderUidAndReminderNumber(secondOrderUid, 2);
      expect(secondReminderStatus).toBe("CANCELLED");

      await testRemindersDb.updateReminderTriggeredAt(secondOrderUid, 1, 15);
      await lambdaInvoker.invokeReminderDispatch();
      const remindersCountAfterSecondDispatch =
        await testRemindersDb.getRemindersCountByOrderUid(secondOrderUid);
      expect(remindersCountAfterSecondDispatch).toBe(2);

      await testRemindersDb.updateReminderTriggeredAt(secondOrderUid, 2, 15);
      await lambdaInvoker.invokeReminderDispatch();
      const remindersCountAfterThirdDispatch =
        await testRemindersDb.getRemindersCountByOrderUid(secondOrderUid);
      expect(remindersCountAfterThirdDispatch).toBe(2);
    },
  );
});
