import { Context, EventBridgeEvent } from "aws-lambda";

import { OrderStatusCodes } from "../lib/db/order-status-db";
import { type OrderStatusReminderRecord } from "./db/types";
import { lambdaHandler } from "./index";
import { init } from "./init";

jest.mock("./init", () => ({
  init: jest.fn(),
}));

const TRIGGERED_AT = new Date("2026-04-01T00:00:00.000Z");

const DISPATCHED_REMINDER_1: OrderStatusReminderRecord = {
  reminderId: "8d5fd7df-fd20-448f-8b22-b3f145b6e336",
  orderUid: "9f44d6e9-7829-49f1-a327-8eca95f5db32",
  triggerStatus: OrderStatusCodes.DISPATCHED,
  reminderNumber: 1,
  triggeredAt: TRIGGERED_AT,
};

const DISPATCHED_REMINDER_2: OrderStatusReminderRecord = {
  reminderId: "2ddb4bcb-ee7f-4f89-a126-30e56fc23338",
  orderUid: "7f97f8a4-75f3-47dc-8faf-f7f9ca6ec1ac",
  triggerStatus: OrderStatusCodes.DISPATCHED,
  reminderNumber: 2,
  triggeredAt: TRIGGERED_AT,
};

describe("reminder-dispatch-lambda", () => {
  const mockProcessReminder = jest.fn<
    Promise<"dispatched">,
    [OrderStatusReminderRecord, unknown]
  >();
  const mockGetScheduledReminders = jest.fn<Promise<OrderStatusReminderRecord[]>, [unknown]>();
  const mockCancelStaleReminders = jest.fn<Promise<{ cancelledCount: number }>, []>();

  const mockedInit = jest.mocked(init);

  const mockEvent = {
    id: "75085c10-f0f6-4e9c-b8e1-093432fedfc4",
    version: "0",
    account: "123456789012",
    time: "2026-04-13T10:00:00Z",
    region: "eu-west-2",
    resources: [],
    source: "hometest.reminders",
    "detail-type": "ReminderDispatchEvent",
    detail: {},
  } as EventBridgeEvent<"ReminderDispatchEvent", Record<string, never>>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetScheduledReminders.mockResolvedValue([DISPATCHED_REMINDER_1, DISPATCHED_REMINDER_2]);
    mockProcessReminder.mockResolvedValue("dispatched");
    mockCancelStaleReminders.mockResolvedValue({ cancelledCount: 0 });

    mockedInit.mockReturnValue({
      reminderProcessor: { process: mockProcessReminder },
      getScheduledRemindersQuery: { execute: mockGetScheduledReminders },
      cancelStaleRemindersCommand: { execute: mockCancelStaleReminders },
      reminderDispatchConfig: {
        enabledReminderStatuses: new Set([OrderStatusCodes.DISPATCHED]),
        reminderConfiguration: {
          [OrderStatusCodes.DISPATCHED]: [
            { interval: 7, eventCode: "DISPATCHED_INITIAL_REMINDER" },
            { interval: 14, eventCode: "DISPATCHED_SECOND_REMINDER" },
          ],
        },
      },
    } as unknown as ReturnType<typeof init>);
  });

  it("cancels stale reminders before processing scheduled ones", async () => {
    const callOrder: string[] = [];
    mockCancelStaleReminders.mockImplementation(async () => {
      callOrder.push("cancel");
      return { cancelledCount: 0 };
    });
    mockGetScheduledReminders.mockImplementation(async () => {
      callOrder.push("getScheduled");
      return [DISPATCHED_REMINDER_1, DISPATCHED_REMINDER_2];
    });

    await lambdaHandler(mockEvent, {} as Context);

    expect(mockCancelStaleReminders).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(["cancel", "getScheduled"]);
  });

  it("creates the processor context with the correct invocation values", async () => {
    await lambdaHandler(mockEvent, {} as Context);

    const expectedContext = {
      schedules: [
        {
          triggerStatus: OrderStatusCodes.DISPATCHED,
          reminderNumber: 1,
          intervalDays: 7,
          eventCode: "DISPATCHED_INITIAL_REMINDER",
        },
        {
          triggerStatus: OrderStatusCodes.DISPATCHED,
          reminderNumber: 2,
          intervalDays: 14,
          eventCode: "DISPATCHED_SECOND_REMINDER",
        },
      ],
      enabledReminderStatuses: new Set([OrderStatusCodes.DISPATCHED]),
      correlationId: mockEvent.id,
    };

    expect(mockProcessReminder).toHaveBeenCalledWith(expect.anything(), expectedContext);
  });

  it("calls process for each scheduled reminder", async () => {
    await lambdaHandler(mockEvent, {} as Context);

    expect(mockProcessReminder).toHaveBeenCalledTimes(2);
    expect(mockProcessReminder).toHaveBeenCalledWith(DISPATCHED_REMINDER_1, expect.any(Object));
    expect(mockProcessReminder).toHaveBeenCalledWith(DISPATCHED_REMINDER_2, expect.any(Object));
  });

  it("counts as failed and does not throw when process rejects unexpectedly", async () => {
    mockProcessReminder.mockRejectedValueOnce(new Error("unexpected error"));

    await expect(lambdaHandler(mockEvent, {} as Context)).resolves.toBeUndefined();
  });

  it("throws and re-throws when getScheduledRemindersQuery rejects", async () => {
    mockGetScheduledReminders.mockRejectedValueOnce(new Error("DB connection failed"));

    await expect(lambdaHandler(mockEvent, {} as Context)).rejects.toThrow("DB connection failed");
    expect(mockProcessReminder).not.toHaveBeenCalled();
  });
});
