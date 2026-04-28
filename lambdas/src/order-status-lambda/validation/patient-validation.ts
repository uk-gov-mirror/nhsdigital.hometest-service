import { ValidationResult, errorResult, successResult } from "../../lib/validation";

const name = "order-status-lambda";

export const validatePatientOwnership = (
  reference: string,
  orderPatientId: string,
  orderId: string,
): ValidationResult => {
  const patientIdFromTask = extractIdFromReference(reference);

  if (!patientIdFromTask) {
    console.error(name, "Invalid patient reference format", { reference });
    return errorResult({
      errorCode: 400,
      errorType: "invalid",
      errorMessage: "Invalid patient reference format",
      severity: "error",
    });
  }

  if (patientIdFromTask !== orderPatientId) {
    console.error(name, "Patient mismatch for order", {
      orderId,
      expectedPatient: orderPatientId,
      providedPatient: patientIdFromTask,
    });
    return errorResult({
      errorCode: 400,
      errorType: "invalid",
      errorMessage: "Patient ID does not match the order",
      severity: "error",
    });
  }

  return successResult();
};

function extractIdFromReference(reference: string): string | null {
  const parts = reference.split("/");

  return parts.length === 2 ? parts[1] : null;
}
