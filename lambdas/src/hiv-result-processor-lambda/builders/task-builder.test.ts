import { Observation, Task } from "fhir/r4";

import { buildTaskFromObservation } from "./task-builder";

describe("buildTaskFromObservation", () => {
  const fixedDate = new Date("2026-04-17T10:20:30.000Z");
  const baseObservation: Pick<Observation, "resourceType" | "status" | "code"> = {
    resourceType: "Observation",
    status: "final",
    code: {
      coding: [
        {
          system: "http://loinc.org",
          code: "75622-1",
        },
      ],
    },
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(fixedDate.getTime());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("builds the expected task from a valid observation", () => {
    const observation: Observation = {
      ...baseObservation,
      basedOn: [{ reference: "ServiceRequest/550e8400-e29b-41d4-a716-446655440000" }],
      subject: { reference: "Patient/550e8400-e29b-41d4-a716-446655440001" },
      performer: [{ reference: "Organization/550e8400-e29b-41d4-a716-446655440002" }],
    };

    const result = buildTaskFromObservation(observation) as Task;

    expect(result).toEqual({
      resourceType: "Task",
      identifier: [
        {
          system: "https://fhir.hometest.nhs.uk/Id/order-id",
          value: "550e8400-e29b-41d4-a716-446655440000",
        },
      ],
      status: "completed",
      intent: "order",
      basedOn: [
        {
          reference: "ServiceRequest/550e8400-e29b-41d4-a716-446655440000",
          type: "ServiceRequest",
        },
      ],
      requester: {
        reference: "Organization/550e8400-e29b-41d4-a716-446655440002",
      },
      for: {
        reference: "Patient/550e8400-e29b-41d4-a716-446655440001",
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
      authoredOn: "2026-04-17T10:20:30.000Z",
      lastModified: "2026-04-17T10:20:30.000Z",
    });
  });

  it("throws when basedOn reference is missing", () => {
    const observation: Observation = {
      ...baseObservation,
      subject: { reference: "Patient/550e8400-e29b-41d4-a716-446655440001" },
      performer: [{ reference: "Organization/550e8400-e29b-41d4-a716-446655440002" }],
    };

    expect(() => buildTaskFromObservation(observation)).toThrow(
      "Observation.basedOn[0].reference is missing",
    );
  });

  it("throws when subject reference is missing", () => {
    const observation: Observation = {
      ...baseObservation,
      basedOn: [{ reference: "ServiceRequest/550e8400-e29b-41d4-a716-446655440000" }],
      subject: { reference: "" },
      performer: [{ reference: "Organization/550e8400-e29b-41d4-a716-446655440002" }],
    };

    expect(() => buildTaskFromObservation(observation)).toThrow("Invalid subject reference format");
  });

  it("throws when performer reference is missing", () => {
    const observation: Observation = {
      ...baseObservation,
      basedOn: [{ reference: "ServiceRequest/550e8400-e29b-41d4-a716-446655440000" }],
      subject: { reference: "Patient/550e8400-e29b-41d4-a716-446655440001" },
      performer: [{ reference: "" }],
    };

    expect(() => buildTaskFromObservation(observation)).toThrow(
      "Invalid performer reference format",
    );
  });
});
