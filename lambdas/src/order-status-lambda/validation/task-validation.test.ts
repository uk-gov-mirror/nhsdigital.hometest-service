import { IncomingBusinessStatus } from "../models/types";
import { validateAndExtractTask } from "./task-validation";

const MOCK_ORDER_UID = "550e8400-e29b-41d4-a716-446655440000";
const MOCK_PATIENT_UID = "patient-123";

const validBody = {
  resourceType: "Task",
  status: "in-progress",
  intent: "order",
  identifier: [{ value: MOCK_ORDER_UID }],
  for: { reference: `Patient/${MOCK_PATIENT_UID}` },
  lastModified: "2024-01-15T10:00:00Z",
  businessStatus: { text: IncomingBusinessStatus.DISPATCHED },
};

describe("validateAndExtractTask", () => {
  describe("Body presence", () => {
    it("should return error when body is null", () => {
      const result = validateAndExtractTask(null);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errorCode).toBe(400);
        expect(result.error.errorType).toBe("invalid");
        expect(result.error.errorMessage).toMatch(/Request body is required/);
      }
    });

    it("should return error when body is an empty string", () => {
      const result = validateAndExtractTask("");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errorMessage).toMatch(/Request body is required/);
      }
    });
  });

  describe("JSON parsing", () => {
    it("should return error when body is invalid JSON", () => {
      const result = validateAndExtractTask("{invalid json");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errorCode).toBe(400);
        expect(result.error.errorMessage).toMatch(/Invalid JSON/);
      }
    });
  });

  describe("Schema validation", () => {
    it("should return error for an empty JSON object", () => {
      const result = validateAndExtractTask("{}");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errorCode).toBe(400);
        expect(result.error.errorType).toBe("invalid");
        expect(result.error.errorMessage).toMatch(/identifier|lastModified|businessStatus/);
      }
    });

    it("should return error when identifier is missing", () => {
      const { identifier: _identifier, ...bodyWithoutIdentifier } = validBody;

      const result = validateAndExtractTask(JSON.stringify(bodyWithoutIdentifier));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errorMessage).toMatch(/identifier/);
      }
    });

    it("should return error when lastModified is missing", () => {
      const { lastModified: _lastModified, ...bodyWithoutLastModified } = validBody;

      const result = validateAndExtractTask(JSON.stringify(bodyWithoutLastModified));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errorMessage).toMatch(/lastModified/);
      }
    });

    it("should return error when businessStatus is missing", () => {
      const { businessStatus: _businessStatus, ...bodyWithoutBusinessStatus } = validBody;

      const result = validateAndExtractTask(JSON.stringify(bodyWithoutBusinessStatus));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errorMessage).toMatch(/businessStatus/);
      }
    });

    it("should return error when businessStatus.text is an unrecognised value", () => {
      const result = validateAndExtractTask(
        JSON.stringify({ ...validBody, businessStatus: { text: "INVALID_STATUS" } }),
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errorMessage).toMatch(/businessStatus/);
      }
    });

    it.each(Object.values(IncomingBusinessStatus))(
      "should return success for valid businessStatus '%s'",
      (status) => {
        const result = validateAndExtractTask(
          JSON.stringify({ ...validBody, businessStatus: { text: status } }),
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.businessStatus.text).toBe(status);
        }
      },
    );

    it("should return success with parsed task for a fully valid body", () => {
      const result = validateAndExtractTask(JSON.stringify(validBody));

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.identifier[0].value).toBe(MOCK_ORDER_UID);
        expect(result.data.for.reference).toBe(`Patient/${MOCK_PATIENT_UID}`);
        expect(result.data.businessStatus.text).toBe(IncomingBusinessStatus.DISPATCHED);
      }
    });
  });
});
