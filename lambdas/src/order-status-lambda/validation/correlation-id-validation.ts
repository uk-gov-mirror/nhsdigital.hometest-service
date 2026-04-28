import { APIGatewayProxyEvent } from "aws-lambda";

import { getCorrelationIdFromEventHeaders } from "../../lib/utils/utils";
import { ValidationResult, errorResult, successResult } from "../../lib/validation";

const name = "order-status-lambda";

export const validateAndExtractCorrelationId = (
  event: APIGatewayProxyEvent,
): ValidationResult<string> => {
  try {
    const correlationId = getCorrelationIdFromEventHeaders(event);
    return successResult(correlationId);
  } catch (error) {
    console.error(name, "Failed to retrieve correlation ID", { error });
    return errorResult({
      errorCode: 400,
      errorType: "invalid",
      errorMessage: error instanceof Error ? error.message : "Invalid correlation ID",
      severity: "error",
    });
  }
};
