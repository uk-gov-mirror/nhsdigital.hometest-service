import { generateReadableError } from "../../lib/utils/validation-utils";
import { ValidationResult, errorResult, successResult } from "../../lib/validation";
import { OrderStatusFHIRTask, orderStatusFHIRTaskSchema } from "../models/schemas";

const name = "order-status-lambda";

export const validateAndExtractTask = (
  body: string | null,
): ValidationResult<OrderStatusFHIRTask> => {
  if (!body) {
    console.error(name, "Missing request body");
    return errorResult({
      errorCode: 400,
      errorType: "invalid",
      errorMessage: "Request body is required",
      severity: "error",
    });
  }

  let task: unknown;

  try {
    task = JSON.parse(body);
  } catch (error) {
    console.error(name, "Invalid JSON in request body", { error });
    return errorResult({
      errorCode: 400,
      errorType: "invalid",
      errorMessage: "Invalid JSON in request body",
      severity: "error",
    });
  }

  const validationResult = orderStatusFHIRTaskSchema.safeParse(task);

  if (!validationResult.success) {
    const errorDetails = generateReadableError(validationResult.error);
    console.error(name, "Task validation failed", { error: errorDetails });
    return errorResult({
      errorCode: 400,
      errorType: "invalid",
      errorMessage: errorDetails,
      severity: "error",
    });
  }

  return successResult(validationResult.data);
};
