import { Observation } from "fhir/r4";

import { isUUID } from "../utils/utils";

export function extractOrderUidFromFHIRObservation(observation: Observation): string {
  if (observation.basedOn?.length === 0) {
    throw new Error("Observation.basedOn is empty");
  }

  const reference = observation.basedOn?.[0]?.reference;

  if (!reference) {
    throw new Error("Observation.basedOn[0].reference is missing");
  }

  // Extract UUID from reference like "ServiceRequest/550e8400-e29b-41d4-a716-446655440000"
  const parts = reference.split("/");
  if (parts.length !== 2) {
    throw new Error("Invalid basedOn reference format");
  }

  const orderUID = parts[1];

  if (!isUUID(orderUID)) {
    throw new Error("Invalid orderUID format");
  }

  return orderUID;
}

export function extractPatientIdFromFHIRObservation(observation: Observation): string {
  const parts = observation.subject!.reference!.split("/");
  if (parts.length !== 2) {
    throw new Error("Invalid subject reference format");
  }

  const patientId = parts[1];

  if (!isUUID(patientId)) {
    throw new Error("Invalid patient ID format");
  }

  return patientId;
}

export function extractSupplierIdFromFHIRObservation(observation: Observation): string {
  const parts = observation.performer![0].reference!.split("/");
  if (parts.length !== 2) {
    throw new Error("Invalid performer reference format");
  }

  return parts[1];
}

export function extractInterpretationCodeFromFHIRObservation(observation: Observation): string {
  return observation.interpretation![0].coding![0].code as string;
}
