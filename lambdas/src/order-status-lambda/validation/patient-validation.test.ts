import { validatePatientOwnership } from "./patient-validation";

const MOCK_ORDER_ID = "550e8400-e29b-41d4-a716-446655440000";
const MOCK_PATIENT_ID = "patient-123";

describe("validatePatientOwnership", () => {
  it("should return success when the patient reference matches the order's patient", () => {
    const result = validatePatientOwnership(
      `Patient/${MOCK_PATIENT_ID}`,
      MOCK_PATIENT_ID,
      MOCK_ORDER_ID,
    );

    expect(result.success).toBe(true);
  });

  it("should return error when the reference format is invalid (no slash)", () => {
    const result = validatePatientOwnership("invalid-reference", MOCK_PATIENT_ID, MOCK_ORDER_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errorCode).toBe(400);
      expect(result.error.errorType).toBe("invalid");
      expect(result.error.errorMessage).toContain("Invalid patient reference");
    }
  });

  it("should return error when the reference has more than two path segments", () => {
    const result = validatePatientOwnership("Patient/123/extra", MOCK_PATIENT_ID, MOCK_ORDER_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errorMessage).toContain("Invalid patient reference");
    }
  });

  it("should return error when the patient ID in the reference does not match the order", () => {
    const result = validatePatientOwnership(
      "Patient/different-patient",
      MOCK_PATIENT_ID,
      MOCK_ORDER_ID,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errorCode).toBe(400);
      expect(result.error.errorType).toBe("invalid");
      expect(result.error.errorMessage).toContain("Patient ID does not match");
    }
  });
});
