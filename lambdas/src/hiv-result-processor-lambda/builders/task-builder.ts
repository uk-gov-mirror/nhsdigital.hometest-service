import { Observation } from "fhir/r4";

import {
  extractOrderUidFromFHIRObservation,
  extractPatientIdFromFHIRObservation,
  extractSupplierIdFromFHIRObservation,
} from "../../lib/fhir-observation-extractors";
import { type FHIRTask } from "../../lib/models/fhir/fhir-service-request-type";

export function buildTaskFromObservation(observation: Observation): FHIRTask {
  const orderUid = extractOrderUidFromFHIRObservation(observation);
  const patientId = extractPatientIdFromFHIRObservation(observation);
  const supplierId = extractSupplierIdFromFHIRObservation(observation);

  const now = new Date().toISOString();

  return {
    resourceType: "Task",
    identifier: [
      {
        system: "https://fhir.hometest.nhs.uk/Id/order-id",
        value: orderUid,
      },
    ],
    status: "completed",
    intent: "order",
    basedOn: [
      {
        reference: `ServiceRequest/${orderUid}`,
        type: "ServiceRequest",
      },
    ],
    requester: {
      reference: `Organization/${supplierId}`,
    },
    for: {
      reference: `Patient/${patientId}`,
    },
    businessStatus: {
      coding: [
        {
          system: "https://fhir.hometest.nhs.uk/CodeSystem/result-business-status",
          code: "result-available",
          display: "Result available to patient",
        },
      ],
      text: "result-available",
    },
    authoredOn: now,
    lastModified: now,
  };
}
