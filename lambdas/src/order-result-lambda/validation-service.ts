import { APIGatewayProxyEvent } from "aws-lambda";
import { Observation } from "fhir/r4";

import { OrderResultSummary } from "../lib/db/order-db";
import {
  extractInterpretationCodeFromFHIRObservation,
  extractOrderUidFromFHIRObservation,
  extractPatientIdFromFHIRObservation,
  extractSupplierIdFromFHIRObservation,
} from "../lib/fhir-observation-extractors";
import { getCorrelationIdFromEventHeaders } from "../lib/utils/utils";
import { generateReadableError } from "../lib/utils/validation-utils";
import {
  ValidationResult,
  ValidationResultError,
  errorResult,
  successResult,
} from "../lib/validation";
import {
  Identifiers,
  InterpretationCode,
  orderResultFHIRObservationSchema,
  resultCodeMapping,
} from "./models";

const name = "order-result-lambda";

function invalidErrorResult(errorMessage: string): ValidationResultError {
  return errorResult({
    errorCode: 400,
    errorType: "invalid",
    errorMessage: errorMessage,
    severity: "error",
  });
}

export const validateAndExtractObservation = (body: string | null): Observation => {
  let observation: Observation;

  try {
    if (body === "{}" || body === null) {
      throw new Error("Body is empty");
    }
    observation = JSON.parse(body);
  } catch (error) {
    console.error(name, "Invalid JSON in request body", { error });
    throw error;
  }

  const validationResult = orderResultFHIRObservationSchema.safeParse(observation);

  if (!validationResult.success) {
    const errorDetails = generateReadableError(validationResult.error);

    console.error(name, "Validation failed", { error: errorDetails });
    throw new Error(`FHIR Observation validation error: ${errorDetails}`);
  }

  return observation;
};

export function extractAndValidateObservationFields(
  event: APIGatewayProxyEvent,
): ValidationResult<{ observation: Observation; identifiers: Identifiers }> {
  let observation: Observation;
  try {
    observation = validateAndExtractObservation(event.body);
  } catch (error) {
    return invalidErrorResult((error as Error).message);
  }

  let correlationId: string;

  try {
    correlationId = getCorrelationIdFromEventHeaders(event);
  } catch (error) {
    console.error(name, "Header validation failed", {
      error: (error as Error).message,
    });
    return invalidErrorResult((error as Error).message);
  }

  let orderUid: string, patientId: string, supplierId: string;

  try {
    orderUid = extractOrderUidFromFHIRObservation(observation);
    patientId = extractPatientIdFromFHIRObservation(observation);
    supplierId = extractSupplierIdFromFHIRObservation(observation);
  } catch (error) {
    console.error(name, "Error extracting identifiers from Observation", {
      error,
    });

    return invalidErrorResult("Unable to extract necessary identifiers from Observation");
  }

  const identifiers: Identifiers = {
    orderUid,
    patientId,
    supplierId,
    correlationId,
  };

  return successResult({
    observation,
    identifiers,
  });
}

export async function validateDBData(
  identifiers: Identifiers,
  observation: Observation,
  testOrderResult: OrderResultSummary,
): Promise<ValidationResult<{ isIdempotent: boolean }>> {
  const interpretationCode = extractInterpretationCodeFromFHIRObservation(
    observation,
  ) as InterpretationCode;
  const { orderUid, patientId, supplierId, correlationId } = identifiers;

  if (!testOrderResult) {
    console.error(name, "Test order not found for orderUid", { orderUid });
    return errorResult({
      errorCode: 404,
      errorType: "not-found",
      errorMessage: `No order found for orderUid ${orderUid}`,
      severity: "error",
    });
  }

  // Idempotency check
  if (testOrderResult.correlation_id && testOrderResult.correlation_id === correlationId) {
    if (resultCodeMapping[interpretationCode] !== testOrderResult.result_status) {
      console.error(
        name,
        "Idempotency check failed, different result detected on same correlation ID.",
        { orderUid, correlationId },
      );
      return errorResult({
        errorCode: 409,
        errorType: "conflict",
        errorMessage:
          "A different result has already been submitted for this order with the same correlation ID",
        severity: "error",
      });
    }

    console.info(
      name,
      "Duplicate submission with same correlation ID detected, returning success without reprocessing",
      { orderUid, correlationId },
    );
    return successResult({
      isIdempotent: true,
    });
  }

  if (testOrderResult.patient_uid !== patientId) {
    console.error(name, "Patient ID in Observation does not match test order record", {
      orderUid,
      patientId,
    });
    return invalidErrorResult("Patient ID in Observation does not match order record");
  }

  if (testOrderResult.supplier_id !== supplierId) {
    console.error(name, "Supplier ID in Observation does not match test order record", {
      orderUid,
      supplierId,
    });
    return errorResult({
      errorCode: 403,
      errorType: "forbidden",
      errorMessage: "Supplier not authorized for this order",
      severity: "error",
    });
  }

  return successResult({ isIdempotent: false });
}

export {
  extractOrderUidFromFHIRObservation,
  extractPatientIdFromFHIRObservation,
  extractSupplierIdFromFHIRObservation,
  extractInterpretationCodeFromFHIRObservation,
} from "../lib/fhir-observation-extractors";
