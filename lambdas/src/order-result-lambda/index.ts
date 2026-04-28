import middy from "@middy/core";
import cors from "@middy/http-cors";
import httpErrorHandler from "@middy/http-error-handler";
import httpSecurityHeaders from "@middy/http-security-headers";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

import { OrderResultSummary } from "../lib/db/order-db";
import { createFhirErrorResponse, createFhirResponse } from "../lib/fhir-response";
import { securityHeaders } from "../lib/http/security-headers";
import { corsOptions } from "./cors-configuration";
import { init } from "./init";
import { extractAndValidateObservationFields, validateDBData } from "./services/validation-service";

const name = "order-result-lambda";

/**
 * Lambda handler for POST /result endpoint
 * Accepts FHIR Observation resources and posts them to processor lambdas after validation.
 * Returns appropriate FHIR responses for success and error cases.
 */
export const lambdaHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  console.info(name, "Received result submission request", {
    path: event.path,
    method: event.httpMethod,
  });

  const { orderService, resultProcessingService } = init();

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
  const logContext = { orderUid: identifiers.orderUid, correlationId: identifiers.correlationId };

  let testOrderResult: OrderResultSummary | null;

  try {
    testOrderResult = await orderService.retrieveOrderDetails(identifiers.orderUid);
  } catch (error) {
    console.error(name, "Failed to retrieve order details", { ...logContext, error });
    return createFhirErrorResponse(500, "exception", "An internal error occurred", "fatal");
  }

  if (!testOrderResult) {
    console.error(name, "Test order not found for orderUid", logContext);
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

  try {
    await resultProcessingService.processValidatedResult({
      correlationId: identifiers.correlationId,
      observation,
    });
  } catch (error) {
    console.error(name, "Result processing failed", { ...logContext, error });
    return createFhirErrorResponse(500, "exception", "An internal error occurred", "fatal");
  }

  return createFhirResponse(201, observation);
};

export const handler = middy(lambdaHandler)
  .use(httpSecurityHeaders(securityHeaders))
  .use(cors(corsOptions))
  .use(httpErrorHandler());
