import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

import { OrderResultSummary } from "../lib/db/order-db";
import { OrderStatusCodes } from "../lib/db/order-status-db";
import { createFhirErrorResponse, createFhirResponse } from "../lib/fhir-response";
import { OrderStatus, ResultStatus } from "../lib/types/status";
import { init } from "./init";
import { Identifiers, InterpretationCode } from "./models";
import {
  extractAndValidateObservationFields,
  extractInterpretationCodeFromFHIRObservation,
  validateDBData,
} from "./validation-service";

const name = "order-result-lambda";

const { orderService, orderStatusNotifyService } = init();

async function updateDatabase(
  identifiers: Identifiers,
  interpretationCode: InterpretationCode,
): Promise<void> {
  if (interpretationCode === InterpretationCode.Normal) {
    await orderService.updateOrderStatusAndResultStatus(
      identifiers.orderUid,
      OrderStatus.Complete,
      ResultStatus.Result_Available,
      identifiers.correlationId,
    );
  }

  if (interpretationCode === InterpretationCode.Abnormal) {
    await orderService.updateOrderStatusAndResultStatus(
      identifiers.orderUid,
      OrderStatus.Received,
      ResultStatus.Result_Withheld,
      identifiers.correlationId,
    );
  }
}

/**
 * Lambda handler for POST /result endpoint
 * Accepts FHIR Observation resources and posts them to database after validation and business logic checks.
 * Returns appropriate FHIR responses for success and error cases.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.info(name, "Received result submission request", {
    path: event.path,
    method: event.httpMethod,
  });

  const validationResult = extractAndValidateObservationFields(event);
  if (!validationResult.success) {
    const error = validationResult.error;
    return createFhirErrorResponse(
      error.errorCode,
      error.errorType,
      error.errorMessage,
      error.severity,
    );
  }

  const { identifiers, observation } = validationResult.data;

  let testOrderResult: OrderResultSummary | null;

  try {
    testOrderResult = await orderService.retrieveOrderDetails(identifiers.orderUid);
  } catch (error) {
    console.error(name, "Failed to retrieve order details", {
      error,
      orderUid: identifiers.orderUid,
    });
    return createFhirErrorResponse(500, "exception", "An internal error occurred", "fatal");
  }

  if (!testOrderResult) {
    console.error(name, "Test order not found for orderUid", {
      orderUid: identifiers.orderUid,
    });
    return createFhirErrorResponse(
      404,
      "not-found",
      `No order found for orderUid ${identifiers.orderUid}`,
      "error",
    );
  }

  const dbValidationResult = await validateDBData(identifiers, observation, testOrderResult);

  if (!dbValidationResult.success) {
    const error = dbValidationResult.error;
    return createFhirErrorResponse(
      error.errorCode,
      error.errorType,
      error.errorMessage,
      error.severity,
    );
  }

  if (dbValidationResult.data.isIdempotent) {
    return createFhirResponse(201, observation);
  }

  const interpretationCode = extractInterpretationCodeFromFHIRObservation(
    observation,
  ) as InterpretationCode;

  try {
    await updateDatabase(identifiers, interpretationCode);
  } catch (error) {
    console.error(name, "Database update failed", { error });
    return createFhirErrorResponse(500, "exception", "An internal error occurred", "fatal");
  }

  if (interpretationCode === InterpretationCode.Normal) {
    try {
      await orderStatusNotifyService.dispatch({
        orderId: identifiers.orderUid,
        patientId: testOrderResult.patient_uid,
        correlationId: identifiers.correlationId,
        statusCode: OrderStatusCodes.COMPLETE,
      });
    } catch (error) {
      console.error(name, "Failed to dispatch order result notification", {
        correlationId: identifiers.correlationId,
        orderId: identifiers.orderUid,
        error,
      });
    }
  }

  return createFhirResponse(201, observation);
};
