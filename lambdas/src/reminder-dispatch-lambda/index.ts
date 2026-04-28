import { Context, EventBridgeEvent } from "aws-lambda";

import { init } from "./init";
import { type ReminderProcessorOutcome } from "./processor/reminder-processor";
import { buildSchedules } from "./processor/schedules";

const name = "reminder-dispatch-lambda";

function countOutcomes(
  outcomes: ReminderProcessorOutcome[],
): Record<ReminderProcessorOutcome, number> {
  const initialCounts: Record<ReminderProcessorOutcome, number> = {
    dispatched: 0,
    failed: 0,
    skipped_disabled: 0,
  };

  return outcomes.reduce((counts, outcome) => {
    counts[outcome]++;
    return counts;
  }, initialCounts);
}

export const lambdaHandler = async (
  event: EventBridgeEvent<"ReminderDispatchEvent", unknown>,
  _context: Context,
): Promise<void> => {
  const {
    reminderProcessor,
    getScheduledRemindersQuery,
    cancelStaleRemindersCommand,
    reminderDispatchConfig,
  } = init();
  const { enabledReminderStatuses, reminderConfiguration } = reminderDispatchConfig;

  const correlationId = event.id;

  try {
    console.info(name, "Reminder dispatch event received", {
      correlationId,
      source: event.source,
      detailType: event["detail-type"],
    });

    const { cancelledCount } = await cancelStaleRemindersCommand.execute();
    console.info(name, "Stale reminders cancelled", { correlationId, cancelledCount });

    const schedules = buildSchedules(reminderConfiguration);
    const reminders = await getScheduledRemindersQuery.execute(schedules);
    const settledOutcomes = await Promise.allSettled(
      reminders.map((reminder) =>
        reminderProcessor.process(reminder, { schedules, enabledReminderStatuses, correlationId }),
      ),
    );

    const outcomes: ReminderProcessorOutcome[] = settledOutcomes.map((result) => {
      if (result.status === "rejected") {
        console.error(name, "Reminder processing threw unexpectedly", {
          correlationId,
          error: result.reason,
        });
        return "failed";
      }
      return result.value;
    });

    const counts = countOutcomes(outcomes);

    console.info(name, "Reminder dispatch completed", {
      correlationId,
      totalCount: reminders.length,
      dispatchedCount: counts.dispatched,
      failedCount: counts.failed,
      skippedDisabledCount: counts.skipped_disabled,
    });
  } catch (error) {
    console.error(name, "Reminder dispatch failed", { correlationId, error });
    throw error;
  }
};

export const handler = lambdaHandler;
