import middy from "@middy/core";
import cors from "@middy/http-cors";
import httpErrorHandler from "@middy/http-error-handler";
import httpSecurityHeaders from "@middy/http-security-headers";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { OrderResultSummary } from "src/lib/db/order-db";

import { createFhirErrorResponse, createFhirResponse } from "../lib/fhir-response";
import { securityHeaders } from "../lib/http/security-headers";
import { type FHIRTask } from "../lib/models/fhir/fhir-service-request-type";
import { OrderStatus, ResultStatus } from "../lib/types/status";
import { getCorrelationIdFromEventHeaders, isUUID } from "../lib/utils/utils";
import { generateReadableError } from "../lib/utils/validation-utils";
import { corsOptions } from "./cors-configuration";
import { init } from "./init";
import { resultStatusFHIRTaskSchema } from "./schemas";

const name = "result-status-lambda";

function parseAndValidateTask(body: string | null, correlationId: string): FHIRTask {
  let parsedTask: unknown;

  if (!body) {
    console.error(name, "Missing request body");
    throw new Error("Request body is required");
  }

  try {
    parsedTask = JSON.parse(body);
  } catch (error) {
    console.error(name, "Invalid JSON in request body", { error, correlationId });
    throw new Error("Invalid JSON in request body", { cause: error });
  }

  const validationResult = resultStatusFHIRTaskSchema.safeParse(parsedTask);

  if (!validationResult.success) {
    const errorDetails = generateReadableError(validationResult.error);
    console.error(name, "Task validation failed", { error: errorDetails, correlationId });
    throw new Error(`Task validation failed: ${errorDetails}`);
  }

  return validationResult.data;
}

function extractPatientIdFromFHIRTask(task: FHIRTask): string {
  const parts = task.for.reference.split("/");
  if (parts.length !== 2) {
    throw new Error("Invalid for.reference format");
  }

  const patientId = parts[1];

  if (!isUUID(patientId)) {
    throw new Error("Invalid patient ID format");
  }

  return patientId;
}

function extractOrderUidFromFHIRTask(task: FHIRTask): string {
  const orderUid = task.identifier?.[0]?.value;

  if (!orderUid) {
    throw new Error("Missing identifier.value");
  }
  if (!isUUID(orderUid)) {
    throw new Error("Invalid identifier.value format");
  }

  return orderUid;
}

/**
 * Lambda handler for POST /result/status endpoint
 * Accepts FHIR Task resources and updates result status on database after validation and business logic checks.
 * Returns appropriate FHIR responses for success and error cases.
 */
export const lambdaHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const { orderService } = init();
  let correlationId: string;

  try {
    correlationId = getCorrelationIdFromEventHeaders(event);
  } catch (error) {
    console.error(name, "Failed to extract correlation ID from request headers", {
      error,
    });
    return createFhirErrorResponse(400, "invalid", "Invalid correlation ID in headers", "error");
  }

  console.info(name, "Received result status request", {
    path: event.path,
    method: event.httpMethod,
    correlationId: correlationId,
  });

  let task: FHIRTask;

  try {
    task = parseAndValidateTask(event.body, correlationId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body";
    return createFhirErrorResponse(400, "invalid", message, "error");
  }

  let patientUid: string, orderUid: string;

  try {
    patientUid = extractPatientIdFromFHIRTask(task);
    orderUid = extractOrderUidFromFHIRTask(task);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid identifiers";
    console.error(name, "Failed to extract identifiers from FHIR Task", {
      error,
      correlationId,
    });
    return createFhirErrorResponse(400, "invalid", message, "error");
  }

  let orderFromOrderUid: OrderResultSummary | null;

  try {
    orderFromOrderUid = await orderService.retrieveOrderDetails(orderUid);
  } catch (error) {
    console.error(name, "Failed to retrieve order details from database", {
      error,
      orderUid,
      correlationId,
    });
    return createFhirErrorResponse(500, "exception", "An internal error occurred", "fatal");
  }

  if (!orderFromOrderUid) {
    console.error(name, "Order not found for given order UID", {
      orderUid,
      correlationId,
    });
    return createFhirErrorResponse(404, "not-found", "Order not found", "error");
  }

  if (orderFromOrderUid.patient_uid !== patientUid) {
    console.error(name, "Patient UID in Task does not match order record", {
      orderUid,
      correlationId,
    });
    return createFhirErrorResponse(
      403,
      "forbidden",
      "Patient UID does not match order record",
      "error",
    );
  }

  if (orderFromOrderUid.correlation_id === correlationId) {
    console.info(name, "Duplicate request detected based on correlation ID", {
      orderUid,
      correlationId,
    });
    return createFhirResponse(200, task);
  }

  try {
    await orderService.updateOrderStatusAndResultStatus(
      orderUid,
      OrderStatus.Complete,
      ResultStatus.Result_Available,
      correlationId,
    );
    console.info(name, "Successfully updated order status and result status", {
      orderUid,
      correlationId,
    });
  } catch (error) {
    console.error(name, "Failed to update result status in database", {
      error,
      orderUid,
      correlationId,
    });
    return createFhirErrorResponse(500, "exception", "An internal error occurred", "fatal");
  }

  //TODO: send notification in HOTE-982
  return createFhirResponse(201, task);
};

export const handler = middy(lambdaHandler)
  .use(httpSecurityHeaders(securityHeaders))
  .use(cors(corsOptions))
  .use(httpErrorHandler());
