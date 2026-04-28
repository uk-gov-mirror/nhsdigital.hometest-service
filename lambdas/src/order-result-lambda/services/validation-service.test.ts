import { APIGatewayProxyEvent } from "aws-lambda";
import { Observation } from "fhir/r4";

import * as fhirExtractors from "../../lib/fhir-observation-extractors";
import { ResultStatus } from "../../lib/types/status";
import { OrderStatus } from "../../lib/types/status";
import * as utils from "../../lib/utils/utils";
import * as validationUtils from "../../lib/utils/validation-utils";
import { InterpretationCode, orderResultFHIRObservationSchema } from "../models";
import * as validation from "./validation-service";

describe("validation-service", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe("validateBody", () => {
    it("throws error when body is null", () => {
      expect(() => validation.validateAndExtractObservation(null)).toThrow("Body is empty");
    });

    it("throws error when body is empty object", () => {
      expect(() => validation.validateAndExtractObservation("{}")).toThrow("Body is empty");
    });

    it("throws error when body is invalid JSON", () => {
      expect(() => validation.validateAndExtractObservation("{invalid json}")).toThrow();
    });

    it("throws error when schema validation fails", () => {
      const generateReadableErrorSpy = jest
        .spyOn(validationUtils, "generateReadableError")
        .mockReturnValue("Invalid schema");

      const invalidObservation = JSON.stringify({ foo: "bar" });
      jest.spyOn(orderResultFHIRObservationSchema, "safeParse").mockReturnValue({
        success: false,
        error: { issues: [{ message: "Invalid schema" }] },
      } as ReturnType<typeof orderResultFHIRObservationSchema.safeParse>);

      expect(() => validation.validateAndExtractObservation(invalidObservation)).toThrow();
      expect(generateReadableErrorSpy).toHaveBeenCalledTimes(1);
    });

    it("does not throw when body is valid and schema passes", () => {
      const validObservation = JSON.stringify({ resourceType: "Observation" });
      jest.spyOn(orderResultFHIRObservationSchema, "safeParse").mockReturnValue({
        success: true,
        data: { resourceType: "Observation" },
      } as ReturnType<typeof orderResultFHIRObservationSchema.safeParse>);

      expect(() => validation.validateAndExtractObservation(validObservation)).not.toThrow();
    });
  });

  describe("extractAndValidateObservationFields", () => {
    const makeEvent = (body: string | null, headers: Record<string, string> = {}) =>
      ({ body, headers }) as unknown as APIGatewayProxyEvent;

    const observation = {
      basedOn: [{ reference: "ServiceRequest/550e8400-e29b-41d4-a716-446655440000" }],
      subject: { reference: "Patient/550e8400-e29b-41d4-a716-446655440001" },
      performer: [{ reference: "Organization/supplier-123" }],
    } as Observation;

    it("returns invalid result when validateBody throws", () => {
      jest.spyOn(validation, "validateAndExtractObservation").mockImplementation(() => {
        throw new Error("bad body");
      });

      const result = validation.extractAndValidateObservationFields(makeEvent('{"x":1}'));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual({
          errorCode: 400,
          errorType: "invalid",
          errorMessage: "bad body",
          severity: "error",
        });
      }
    });

    it("returns invalid result when correlation header is invalid", () => {
      jest.spyOn(validation, "validateAndExtractObservation").mockReturnValue(observation);
      jest.spyOn(utils, "getCorrelationIdFromEventHeaders").mockImplementation(() => {
        throw new Error("missing correlation id");
      });

      const result = validation.extractAndValidateObservationFields(makeEvent('{"x":1}'));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual({
          errorCode: 400,
          errorType: "invalid",
          errorMessage: "missing correlation id",
          severity: "error",
        });
      }
    });

    it("returns invalid result when identifier extraction fails", () => {
      jest.spyOn(validation, "validateAndExtractObservation").mockReturnValue(observation);
      jest.spyOn(utils, "getCorrelationIdFromEventHeaders").mockReturnValue("corr-id");
      jest.spyOn(fhirExtractors, "extractOrderUidFromFHIRObservation").mockImplementation(() => {
        throw new Error("bad order uid");
      });

      const result = validation.extractAndValidateObservationFields(makeEvent('{"x":1}'));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual({
          errorCode: 400,
          errorType: "invalid",
          errorMessage: "Unable to extract necessary identifiers from Observation",
          severity: "error",
        });
      }
    });

    it("returns valid result with observation and identifiers on success", () => {
      jest.spyOn(validation, "validateAndExtractObservation").mockReturnValue(observation);
      jest.spyOn(utils, "getCorrelationIdFromEventHeaders").mockReturnValue("corr-id");

      const observationEvent = {
        basedOn: [{ reference: "ServiceRequest/550e8400-e29b-41d4-a716-446655440000" }],
        subject: { reference: "Patient/550e8400-e29b-41d4-a716-446655440001" },
        performer: [{ reference: "Organization/supplier-123" }],
      };
      const result = validation.extractAndValidateObservationFields(
        makeEvent(JSON.stringify(observationEvent)),
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.identifiers).toEqual({
          orderUid: "550e8400-e29b-41d4-a716-446655440000",
          patientId: "550e8400-e29b-41d4-a716-446655440001",
          supplierId: "supplier-123",
          correlationId: "corr-id",
        });
        expect(result.data.observation).toEqual(observation);
      }
    });
  });

  describe("validateDBData", () => {
    let identifiers: any;
    let observation: any;
    let testOrderResult: any;

    beforeEach(() => {
      identifiers = {
        orderUid: "order-uid",
        patientId: "patient-uid",
        supplierId: "supplier-123",
        correlationId: "corr-id",
      };

      observation = {
        interpretation: [{ coding: [{ code: "N" }] }],
      };

      testOrderResult = {
        correlation_id: "corr-id",
        result_status: ResultStatus.Result_Available,
        patient_uid: "patient-uid",
        supplier_id: "supplier-123",
      };

      jest
        .spyOn(fhirExtractors, "extractInterpretationCodeFromFHIRObservation")
        .mockReturnValue(InterpretationCode.Normal);
    });

    it("returns not-found when testOrderResult is null", async () => {
      const result = await validation.validateDBData(identifiers, observation, null as any);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual({
          errorCode: 404,
          errorType: "not-found",
          errorMessage: "No order found for orderUid order-uid",
          severity: "error",
        });
      }
    });

    it("returns conflict when idempotency check fails (different result)", async () => {
      testOrderResult.result_status = ResultStatus.Result_Withheld; // mismatch with mapping
      const result = await validation.validateDBData(identifiers, observation, testOrderResult);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual({
          errorCode: 409,
          errorType: "conflict",
          errorMessage:
            "A different result has already been submitted for this order with the same correlation ID",
          severity: "error",
        });
      }
    });

    it("returns success and isIdempotent=true when idempotency check passes (same result)", async () => {
      testOrderResult.result_status = ResultStatus.Result_Available; // matches mapping
      const result = await validation.validateDBData(identifiers, observation, testOrderResult);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          isIdempotent: true,
        });
      }
    });

    it("returns conflict when order is already complete", async () => {
      testOrderResult.correlation_id = undefined; // skip idempotency
      testOrderResult.order_status_code = OrderStatus.Complete;
      const result = await validation.validateDBData(identifiers, observation, testOrderResult);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual({
          errorCode: 409,
          errorType: "conflict",
          errorMessage: "Order order-uid is already complete",
          severity: "error",
        });
      }
    });

    it("returns invalid when patient_uid does not match", async () => {
      testOrderResult.correlation_id = undefined; // skip idempotency
      testOrderResult.patient_uid = "other-patient";
      const result = await validation.validateDBData(identifiers, observation, testOrderResult);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual({
          errorCode: 400,
          errorType: "invalid",
          errorMessage: "Patient ID in Observation does not match order record",
          severity: "error",
        });
      }
    });

    it("returns forbidden when supplier_id does not match", async () => {
      testOrderResult.correlation_id = undefined; // skip idempotency
      testOrderResult.supplier_id = "other-supplier";
      const result = await validation.validateDBData(identifiers, observation, testOrderResult);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual({
          errorCode: 403,
          errorType: "forbidden",
          errorMessage: "Supplier not authorized for this order",
          severity: "error",
        });
      }
    });

    it("returns valid when all checks pass and not idempotent", async () => {
      testOrderResult.correlation_id = undefined; // skip idempotency
      testOrderResult.patient_uid = "patient-uid";
      testOrderResult.supplier_id = "supplier-123";
      const result = await validation.validateDBData(identifiers, observation, testOrderResult);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ isIdempotent: false });
      }
    });
  });
});
