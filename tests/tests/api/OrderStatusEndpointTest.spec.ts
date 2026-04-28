import { test } from "../../fixtures/CombinedTestFixture";
import { OrderBuilder } from "../../test-data/OrderBuilder";

test.describe("GET Order API", { tag: ["@API", "@db"] }, () => {
  let orderId: string;
  let patientId: string;

  test.beforeAll(async ({ testedUser, testOrderDb }) => {
    const result = await testOrderDb.createOrderWithPatientAndStatus(
      new OrderBuilder().withUser(testedUser).build(),
    );

    orderId = result.order_uid;
    patientId = result.patient_uid;
  });

  test(
    "should retrieve order and confirm status changes",
    { tag: ["@API"] },
    async ({ orderApi, testedUser, testOrderDb }) => {
      const nhsNumber = testedUser.nhsNumber!;
      const dob = testedUser.dob!;

      await orderApi.assertOrderHasStatus(nhsNumber, dob, orderId, "CONFIRMED");

      await testOrderDb.updateOrderStatus(orderId, "DISPATCHED");
      await orderApi.assertOrderHasStatus(nhsNumber, dob, orderId, "DISPATCHED");

      await testOrderDb.updateOrderStatus(orderId, "RECEIVED");
      await orderApi.assertOrderHasStatus(nhsNumber, dob, orderId, "RECEIVED");

      await testOrderDb.updateOrderStatus(orderId, "COMPLETE");
      await orderApi.assertOrderHasStatus(nhsNumber, dob, orderId, "COMPLETE");
    },
  );

  test.afterAll(async ({ testedUser, testOrderDb }) => {
    await testOrderDb.deleteOrdersByPatientCascade(patientId);
    await testOrderDb.deletePatientMapping(testedUser.nhsNumber!, testedUser.dob!);
  });
});
