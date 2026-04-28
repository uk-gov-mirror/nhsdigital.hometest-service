import middy from "@middy/core";
import cors from "@middy/http-cors";
import httpErrorHandler from "@middy/http-error-handler";
import httpSecurityHeaders from "@middy/http-security-headers";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ValidationError } from "src/lib/validation";

import { OrderStatusUpdateParams } from "../lib/db/order-status-db";
import { createFhirErrorResponse, createFhirResponse } from "../lib/fhir-response";
import { securityHeaders } from "../lib/http/security-headers";
import { corsOptions } from "./cors-configuration";
import { init } from "./init";
import { resolveStatus } from "./models/mappings";
import { StatusKind } from "./models/types";
import { validateAndExtractCorrelationId } from "./validation/correlation-id-validation";
import { validatePatientOwnership } from "./validation/patient-validation";
import { validateAndExtractTask } from "./validation/task-validation";

const name = "order-status-lambda";

const fhirErrorFromValidation = (error: ValidationError): APIGatewayProxyResult =>
  createFhirErrorResponse(error.errorCode, error.errorType, error.errorMessage, error.severity);

/**
 * Lambda handler for POST /test-order/status endpoint
 * Validates and processes an incoming FHIR Task resource, updating either the order status or
 * result status, dispatching notifications, and managing reminders accordingly.
 */
export const lambdaHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const {
    orderStatusDb,
    orderStatusReminderService,
    orderStatusNotifyService,
    insertResultStatusCommand,
  } = init();

  console.info(name, "Received order status update request", {
    path: event.path,
    method: event.httpMethod,
  });

  try {
    const correlationIdValidationResult = validateAndExtractCorrelationId(event);
    if (!correlationIdValidationResult.success) {
      return fhirErrorFromValidation(correlationIdValidationResult.error);
    }
    const correlationId = correlationIdValidationResult.data;

    const taskValidationResult = validateAndExtractTask(event.body);
    if (!taskValidationResult.success) {
      return fhirErrorFromValidation(taskValidationResult.error);
    }
    const task = taskValidationResult.data;
    const orderId = task.identifier[0].value;
    const logContext = { orderId, correlationId };

    const orderPatientId = await orderStatusDb.getPatientIdFromOrder(orderId);
    if (!orderPatientId) {
      console.error(name, "Order not found", { orderId });

      return createFhirErrorResponse(
        404,
        "not-found",
        `Order with id ${orderId} not found`,
        "error",
      );
    }

    const patientOwnershipValidationResult = validatePatientOwnership(
      task.for.reference,
      orderPatientId,
      orderId,
    );

    if (!patientOwnershipValidationResult.success) {
      return fhirErrorFromValidation(patientOwnershipValidationResult.error);
    }

    const idempotencyCheck = await orderStatusDb.checkIdempotency(orderId, correlationId);
    if (idempotencyCheck.isDuplicate) {
      console.info(name, "Duplicate update detected via correlation ID", logContext);

      return createFhirResponse(200, task);
    }

    const incomingStatus = task.businessStatus.text;
    const resolved = resolveStatus(incomingStatus);

    switch (resolved.kind) {
      case StatusKind.Result: {
        try {
          await insertResultStatusCommand.execute(orderId, resolved.status, correlationId);
        } catch (error) {
          console.warn(name, "Failed to update result status", {
            ...logContext,
            resultStatus: resolved.status,
          });
        }

        console.info(name, "Result status update added successfully", {
          ...logContext,
          resultStatus: resolved.status,
        });

        return createFhirResponse(201, task);
      }

      case StatusKind.Order: {
        const statusOrderUpdateParams: OrderStatusUpdateParams = {
          orderId,
          statusCode: resolved.status,
          createdAt: task.lastModified,
          correlationId,
        };

        await orderStatusDb.addOrderStatusUpdate(statusOrderUpdateParams);
        console.info(name, "Order status update added successfully", statusOrderUpdateParams);

        try {
          await orderStatusNotifyService.dispatch({
            orderId,
            patientId: orderPatientId,
            correlationId,
            statusCode: statusOrderUpdateParams.statusCode,
          });
        } catch (error) {
          console.error(name, "Failed to dispatch order status notification", {
            ...logContext,
            error,
          });
        }

        await orderStatusReminderService.handleOrderStatusUpdated({
          orderId,
          correlationId,
          statusCode: statusOrderUpdateParams.statusCode,
          triggeredAt: statusOrderUpdateParams.createdAt,
        });

        return createFhirResponse(201, task);
      }

      default:
        return createFhirErrorResponse(400, "invalid", "Unrecognised business status", "error");
    }
  } catch (error) {
    console.error(name, "Error processing order status update", { error });
    return createFhirErrorResponse(500, "exception", "An internal error occurred", "fatal");
  }
};

export const handler = middy(lambdaHandler)
  .use(httpSecurityHeaders(securityHeaders))
  .use(cors(corsOptions))
  .use(httpErrorHandler());
