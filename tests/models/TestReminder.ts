import { OrderStatusCode } from "./TestOrder";

export type UUID = string;

export type ReminderStatusCode = "SCHEDULED" | "QUEUED" | "CANCELLED";

export interface ReminderModel {
  reminder_id: string;
  order_uid: string;
  trigger_status: OrderStatusCode;
  reminder_number: number;
  status: ReminderStatusCode;
  triggered_at: Date;
  sent_at: Date | null;
  created_at: Date;
}

export function isValidReminder(reminder: ReminderModel): boolean {
  return (
    !!reminder.order_uid &&
    !!reminder.reminder_id &&
    !!reminder.trigger_status &&
    !!reminder.reminder_number &&
    !!reminder.status &&
    reminder.triggered_at instanceof Date &&
    (reminder.sent_at === null || reminder.sent_at instanceof Date) &&
    reminder.created_at instanceof Date
  );
}
