import { Observation } from "fhir/r4";

import {
  extractInterpretationCodeFromFHIRObservation,
  extractOrderUidFromFHIRObservation,
  extractPatientIdFromFHIRObservation,
  extractSupplierIdFromFHIRObservation,
} from ".";

const validUuid = "550e8400-e29b-41d4-a716-446655440000";
const patientUuid = "660e8400-e29b-41d4-a716-446655440001";
const supplierUuid = "770e8400-e29b-41d4-a716-446655440002";

const baseObservation: Observation = {
  resourceType: "Observation",
  status: "final",
  code: {},
  basedOn: [{ reference: `ServiceRequest/${validUuid}` }],
  subject: { reference: `Patient/${patientUuid}` },
  performer: [{ reference: `Organization/${supplierUuid}` }],
  interpretation: [{ coding: [{ code: "N" }] }],
};

describe("extractOrderUidFromFHIRObservation", () => {
  it("returns the order UID from basedOn reference", () => {
    expect(extractOrderUidFromFHIRObservation(baseObservation)).toBe(validUuid);
  });

  it("throws when basedOn is empty", () => {
    const observation: Observation = { ...baseObservation, basedOn: [] };

    expect(() => extractOrderUidFromFHIRObservation(observation)).toThrow(
      "Observation.basedOn is empty",
    );
  });

  it("throws when basedOn reference is missing", () => {
    const observation: Observation = { ...baseObservation, basedOn: [{}] };

    expect(() => extractOrderUidFromFHIRObservation(observation)).toThrow(
      "Observation.basedOn[0].reference is missing",
    );
  });

  it("throws when basedOn reference format is invalid", () => {
    const observation: Observation = {
      ...baseObservation,
      basedOn: [{ reference: "invalid-format" }],
    };

    expect(() => extractOrderUidFromFHIRObservation(observation)).toThrow(
      "Invalid basedOn reference format",
    );
  });

  it("throws when the extracted ID is not a valid UUID", () => {
    const observation: Observation = {
      ...baseObservation,
      basedOn: [{ reference: "ServiceRequest/not-a-uuid" }],
    };

    expect(() => extractOrderUidFromFHIRObservation(observation)).toThrow(
      "Invalid orderUID format",
    );
  });
});

describe("extractPatientIdFromFHIRObservation", () => {
  it("returns the patient ID from subject reference", () => {
    expect(extractPatientIdFromFHIRObservation(baseObservation)).toBe(patientUuid);
  });

  it("throws when subject reference format is invalid", () => {
    const observation: Observation = {
      ...baseObservation,
      subject: { reference: "invalid-format" },
    };

    expect(() => extractPatientIdFromFHIRObservation(observation)).toThrow(
      "Invalid subject reference format",
    );
  });

  it("throws when the extracted ID is not a valid UUID", () => {
    const observation: Observation = {
      ...baseObservation,
      subject: { reference: "Patient/not-a-uuid" },
    };

    expect(() => extractPatientIdFromFHIRObservation(observation)).toThrow(
      "Invalid patient ID format",
    );
  });
});

describe("extractSupplierIdFromFHIRObservation", () => {
  it("returns the supplier ID from performer reference", () => {
    expect(extractSupplierIdFromFHIRObservation(baseObservation)).toBe(supplierUuid);
  });

  it("throws when performer reference format is invalid", () => {
    const observation: Observation = {
      ...baseObservation,
      performer: [{ reference: "invalid-format" }],
    };

    expect(() => extractSupplierIdFromFHIRObservation(observation)).toThrow(
      "Invalid performer reference format",
    );
  });
});

describe("extractInterpretationCodeFromFHIRObservation", () => {
  it("returns the interpretation code from the observation", () => {
    expect(extractInterpretationCodeFromFHIRObservation(baseObservation)).toBe("N");
  });

  it("returns 'A' for an abnormal result", () => {
    const observation: Observation = {
      ...baseObservation,
      interpretation: [{ coding: [{ code: "A" }] }],
    };

    expect(extractInterpretationCodeFromFHIRObservation(observation)).toBe("A");
  });
});
