import { PostgresDbClient } from "../lib/db/db-client";
import { postgresConfigFromEnv } from "../lib/db/db-config";
import { NotificationAuditDbClient } from "../lib/db/notification-audit-db-client";
import { OrderDbClient } from "../lib/db/order-db-client";
import { OrderStatusCodes, OrderStatusService } from "../lib/db/order-status-db";
import { OrderStatusReminderDbClient } from "../lib/db/order-status-reminder-db-client";
import { PatientDbClient } from "../lib/db/patient-db-client";
import { OrderConfirmedMessageBuilder } from "../lib/notify/message-builders/order-status/order-confirmed-message-builder";
import { OrderDispatchedMessageBuilder } from "../lib/notify/message-builders/order-status/order-dispatched-message-builder";
import { OrderReceivedMessageBuilder } from "../lib/notify/message-builders/order-status/order-received-message-builder";
import { OrderStatusNotifyService } from "../lib/notify/services/order-status-notify-service";
import { OrderStatusReminderService } from "../lib/reminder/order-status-reminder-service";
import { AwsSecretsClient } from "../lib/secrets/secrets-manager-client";
import { AWSSQSClient } from "../lib/sqs/sqs-client";
import { retrieveMandatoryEnvVariable } from "../lib/utils/utils";
import { InsertResultStatusCommand } from "./db/commands/insert-result-status";

export interface Environment {
  orderStatusDb: OrderStatusService;
  orderStatusReminderService: OrderStatusReminderService;
  orderStatusNotifyService: OrderStatusNotifyService;
  insertResultStatusCommand: InsertResultStatusCommand;
}

export function buildEnvironment(): Environment {
  const awsRegion = retrieveMandatoryEnvVariable("AWS_REGION");
  const notifyMessagesQueueUrl = retrieveMandatoryEnvVariable("NOTIFY_MESSAGES_QUEUE_URL");
  const homeTestBaseUrl = retrieveMandatoryEnvVariable("HOME_TEST_BASE_URL");
  const secretsClient = new AwsSecretsClient(awsRegion);
  const dbClient = new PostgresDbClient(postgresConfigFromEnv(secretsClient));
  const orderStatusDb = new OrderStatusService(dbClient);
  const orderStatusReminderDbClient = new OrderStatusReminderDbClient(dbClient);
  const orderStatusReminderService = new OrderStatusReminderService({
    orderStatusReminderDbClient,
  });
  const patientDbClient = new PatientDbClient(dbClient);
  const orderDbClient = new OrderDbClient(dbClient);
  const notificationAuditDbClient = new NotificationAuditDbClient(dbClient);
  const sqsClient = new AWSSQSClient(awsRegion);
  const builderDeps = { patientDbClient, orderDbClient, homeTestBaseUrl };
  const orderStatusNotifyService = new OrderStatusNotifyService({
    notifyMessageBuilders: {
      [OrderStatusCodes.CONFIRMED]: new OrderConfirmedMessageBuilder(builderDeps),
      [OrderStatusCodes.DISPATCHED]: new OrderDispatchedMessageBuilder(builderDeps, orderStatusDb),
      [OrderStatusCodes.RECEIVED]: new OrderReceivedMessageBuilder(builderDeps, orderStatusDb),
    },
    notificationAuditDbClient,
    sqsClient,
    notifyMessagesQueueUrl,
  });
  const insertResultStatusCommand = new InsertResultStatusCommand(dbClient);

  return {
    orderStatusDb,
    orderStatusReminderService,
    orderStatusNotifyService,
    insertResultStatusCommand,
  };
}

let _env: Environment | undefined;

export function init(): Environment {
  _env ??= buildEnvironment();
  return _env;
}
