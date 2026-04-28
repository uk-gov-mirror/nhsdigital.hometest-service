import middy from "@middy/core";
import httpErrorHandler from "@middy/http-error-handler";
import httpSecurityHeaders from "@middy/http-security-headers";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Observation } from "fhir/r4";

import { extractInterpretationCodeFromFHIRObservation } from "../lib/fhir-observation-extractors";
import { createFhirErrorResponse, createFhirResponse } from "../lib/fhir-response";
import { securityHeaders } from "../lib/http/security-headers";
import { getCorrelationIdFromEventHeaders } from "../lib/utils/utils";
import { buildTaskFromObservation } from "./builders/task-builder";
import { init } from "./init";
import { InterpretationCode } from "./models/interpretation";

const name = "hiv-results-processor";

export const lambdaHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const { resultStatusLambdaService } = init();

  console.info(name, "Received HIV result", {
    path: event.path,
    method: event.httpMethod,
  });

  let correlationId: string;
  try {
    correlationId = getCorrelationIdFromEventHeaders(event);
  } catch (error) {
    console.error(name, "Missing or invalid correlation ID in request headers", {
      error,
    });
    return createFhirErrorResponse(400, "invalid", "Missing or invalid correlation ID", "error");
  }

  let observation: Observation;
  try {
    observation = JSON.parse(event.body ?? "");
  } catch (error) {
    console.error(name, "Invalid JSON in request body", { correlationId, error });
    return createFhirErrorResponse(400, "invalid", "Invalid JSON body", "error");
  }

  const interpretation = extractInterpretationCodeFromFHIRObservation(
    observation,
  ) as InterpretationCode;

  if (interpretation === InterpretationCode.Abnormal) {
    console.info(name, "Reactive result ignored", { correlationId });
    return createFhirResponse(200, observation);
  }

  if (interpretation === InterpretationCode.Normal) {
    try {
      const taskPayload = buildTaskFromObservation(observation);
      await resultStatusLambdaService.sendResult(taskPayload, correlationId);

      return createFhirResponse(200, observation);
    } catch (error) {
      console.error(name, "Failed to send task to status lambda", { correlationId, error });
      return createFhirErrorResponse(500, "exception", "Status update failed", "fatal");
    }
  }

  return createFhirResponse(200, observation);
};

export const handler = middy(lambdaHandler)
  .use(httpSecurityHeaders(securityHeaders))
  .use(httpErrorHandler());
