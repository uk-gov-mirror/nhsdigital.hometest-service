import { APIGatewayProxyEvent, Context } from "aws-lambda";

import { IdempotencyCheckResult } from "../lib/db/order-status-db";
import { OrderStatus } from "../lib/types/status";
import { errorResult, successResult } from "../lib/validation";
import { OrderStatusFHIRTask } from "./models/schemas";
import { IncomingBusinessStatus } from "./models/types";

const mockInit = jest.fn();

const mockGetPatientIdFromOrder = jest.fn();
const mockCheckIdempotency = jest.fn();
const mockAddOrderStatusUpdate = jest.fn();
const mockNotify = jest.fn();
const mockHandleReminderOrderStatusUpdated = jest.fn();
const mockInsertResultStatusCommand = jest.fn();

const mockValidateAndExtractCorrelationId = jest.fn();
const mockValidateAndExtractTask = jest.fn();
const mockValidatePatientOwnership = jest.fn();

jest.mock("./init", () => ({
  init: mockInit,
}));

jest.mock("./validation/correlation-id-validation", () => ({
  validateAndExtractCorrelationId: mockValidateAndExtractCorrelationId,
}));

jest.mock("./validation/task-validation", () => ({
  validateAndExtractTask: mockValidateAndExtractTask,
}));

jest.mock("./validation/patient-validation", () => ({
  validatePatientOwnership: mockValidatePatientOwnership,
}));

const MOCK_CORRELATION_ID = "123e4567-e89b-12d3-a456-426614174000";
const MOCK_ORDER_UID = "550e8400-e29b-41d4-a716-446655440000";
const MOCK_PATIENT_UID = "patient-123";
const MOCK_BUSINESS_STATUS = IncomingBusinessStatus.DISPATCHED;

describe("Order Status Lambda Handler", () => {
  let handler: (event: APIGatewayProxyEvent, context: Context) => Promise<any>;
  let mockEvent: Partial<APIGatewayProxyEvent>;

  const validTask: OrderStatusFHIRTask = {
    resourceType: "Task",
    status: "in-progress",
    intent: "order",
    identifier: [
      {
        value: MOCK_ORDER_UID,
      },
    ],
    for: {
      reference: `Patient/${MOCK_PATIENT_UID}`,
    },
    lastModified: "2024-01-15T10:00:00Z",
    businessStatus: {
      text: MOCK_BUSINESS_STATUS,
    },
  };

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    mockEvent = {};

    mockValidateAndExtractCorrelationId.mockReturnValue(successResult(MOCK_CORRELATION_ID));
    mockValidateAndExtractTask.mockReturnValue(successResult(validTask));
    mockValidatePatientOwnership.mockReturnValue(successResult());

    mockGetPatientIdFromOrder.mockResolvedValue(MOCK_PATIENT_UID);
    mockCheckIdempotency.mockResolvedValue({ isDuplicate: false });
    mockAddOrderStatusUpdate.mockResolvedValue(undefined);
    mockNotify.mockResolvedValue(undefined);
    mockHandleReminderOrderStatusUpdated.mockResolvedValue(undefined);
    mockInsertResultStatusCommand.mockResolvedValue(undefined);

    mockInit.mockReturnValue({
      orderStatusDb: {
        getPatientIdFromOrder: mockGetPatientIdFromOrder,
        checkIdempotency: mockCheckIdempotency,
        addOrderStatusUpdate: mockAddOrderStatusUpdate,
      },
      orderStatusNotifyService: {
        dispatch: mockNotify,
      },
      orderStatusReminderService: {
        handleOrderStatusUpdated: mockHandleReminderOrderStatusUpdated,
      },
      insertResultStatusCommand: {
        execute: mockInsertResultStatusCommand,
      },
    });

    const module = await import("./index");

    handler = module.lambdaHandler;
  });

  describe("Validation Delegation", () => {
    it("should return FHIR error when correlation ID validation fails", async () => {
      mockValidateAndExtractCorrelationId.mockReturnValueOnce(
        errorResult({
          errorCode: 400,
          errorType: "invalid",
          errorMessage: "Correlation ID is missing or invalid",
          severity: "error",
        }),
      );

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.resourceType).toBe("OperationOutcome");
      expect(body.issue[0].code).toBe("invalid");
      expect(body.issue[0].diagnostics).toMatch(/correlation id/i);
    });

    it("should return FHIR error when task validation fails", async () => {
      mockValidateAndExtractTask.mockReturnValueOnce(
        errorResult({
          errorCode: 400,
          errorType: "invalid",
          errorMessage: "Request body is required",
          severity: "error",
        }),
      );

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.resourceType).toBe("OperationOutcome");
      expect(body.issue[0].code).toBe("invalid");
    });

    it("should return FHIR error when patient ownership validation fails", async () => {
      mockValidatePatientOwnership.mockReturnValueOnce(
        errorResult({
          errorCode: 400,
          errorType: "invalid",
          errorMessage: "Patient ID does not match the order",
          severity: "error",
        }),
      );

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.resourceType).toBe("OperationOutcome");
      expect(body.issue[0].diagnostics).toContain("Patient ID does not match");
    });
  });

  describe("Order Existence", () => {
    it("should return 404 when order does not exist", async () => {
      mockGetPatientIdFromOrder.mockResolvedValueOnce(null);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(404);

      const body = JSON.parse(result.body);

      expect(body.resourceType).toBe("OperationOutcome");
      expect(body.issue[0].code).toBe("not-found");
      expect(body.issue[0].diagnostics).toContain("not found");
    });

    it("should proceed when order exists", async () => {
      mockGetPatientIdFromOrder.mockResolvedValueOnce(MOCK_PATIENT_UID);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(mockGetPatientIdFromOrder).toHaveBeenCalledWith(MOCK_ORDER_UID);
      expect(result.statusCode).toBe(201);
    });
  });

  describe("Idempotency via Correlation ID", () => {
    it("should detect duplicate updates with same correlation ID", async () => {
      mockCheckIdempotency.mockResolvedValueOnce({
        isDuplicate: true,
      } satisfies Partial<IdempotencyCheckResult>);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(200);
      expect(mockCheckIdempotency).toHaveBeenCalledWith(MOCK_ORDER_UID, MOCK_CORRELATION_ID);
      expect(mockHandleReminderOrderStatusUpdated).not.toHaveBeenCalled();
      expect(mockNotify).not.toHaveBeenCalled();
    });

    it("should process new updates with a different correlation ID", async () => {
      const newCorrelationId = "mock-new-correlation-id-123";
      mockValidateAndExtractCorrelationId.mockReturnValueOnce(successResult(newCorrelationId));

      mockCheckIdempotency.mockResolvedValueOnce({
        isDuplicate: false,
      } satisfies IdempotencyCheckResult);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(201);

      expect(mockAddOrderStatusUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: newCorrelationId,
        }),
      );
    });
  });

  describe("Timestamp Handling", () => {
    it("should use lastModified timestamp when it is older than the latest update", async () => {
      const mockedLastModifiedTimestamp = "2024-01-15T08:00:00Z";
      mockValidateAndExtractTask.mockReturnValueOnce(
        successResult({ ...validTask, lastModified: mockedLastModifiedTimestamp }),
      );

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(201);

      expect(mockAddOrderStatusUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          createdAt: mockedLastModifiedTimestamp,
        }),
      );
    });

    it("should use lastModified timestamp when it is newer than the latest update", async () => {
      const mockedLastModifiedTimestamp = "2024-01-15T11:00:00Z";
      mockValidateAndExtractTask.mockReturnValueOnce(
        successResult({ ...validTask, lastModified: mockedLastModifiedTimestamp }),
      );

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(201);

      expect(mockAddOrderStatusUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          createdAt: mockedLastModifiedTimestamp,
        }),
      );
    });
  });

  describe("Successful Update", () => {
    it("should return 201 OK with updated Task when all validations pass", async () => {
      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(201);
      expect(result.headers?.["Content-Type"]).toBe("application/fhir+json");

      const body = JSON.parse(result.body);

      expect(body.resourceType).toBe("Task");
      expect(body.status).toBe(validTask.status);
      expect(body.for.reference).toBe(`Patient/${MOCK_PATIENT_UID}`);
    });

    it("should call addOrderStatusUpdate with correct parameters", async () => {
      await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(mockAddOrderStatusUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: MOCK_ORDER_UID,
          statusCode: OrderStatus.Dispatched,
          createdAt: validTask.lastModified,
          correlationId: MOCK_CORRELATION_ID,
        }),
      );
    });

    it("should delegate post-update side effects to the notification service", async () => {
      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(201);
      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: MOCK_PATIENT_UID,
          correlationId: MOCK_CORRELATION_ID,
          orderId: MOCK_ORDER_UID,
          statusCode: OrderStatus.Dispatched,
        }),
      );
    });

    it("should still delegate non-dispatched statuses to the notification service", async () => {
      mockValidateAndExtractTask.mockReturnValueOnce(
        successResult({
          ...validTask,
          businessStatus: { text: IncomingBusinessStatus.RECEIVED_AT_LAB },
        }),
      );

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(201);
      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: OrderStatus.Received,
        }),
      );
    });

    it("should delegate confirmed statuses to the notification service", async () => {
      mockValidateAndExtractTask.mockReturnValueOnce(
        successResult({
          ...validTask,
          businessStatus: { text: IncomingBusinessStatus.ORDER_ACCEPTED },
        }),
      );

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(201);
      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: OrderStatus.Confirmed,
        }),
      );
    });

    it("should delegate reminder scheduling to the reminder service", async () => {
      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(201);
      expect(mockHandleReminderOrderStatusUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: MOCK_ORDER_UID,
          correlationId: MOCK_CORRELATION_ID,
          statusCode: OrderStatus.Dispatched,
          triggeredAt: validTask.lastModified,
        }),
      );
    });

    it("should return 201 when notification service fails after a successful status update", async () => {
      mockNotify.mockRejectedValueOnce(new Error("Unexpected side effect error"));

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(201);
    });
  });

  describe("Result Status Update (TEST_PROCESSED)", () => {
    beforeEach(() => {
      mockValidateAndExtractTask.mockReturnValue(
        successResult({
          ...validTask,
          businessStatus: { text: IncomingBusinessStatus.TEST_PROCESSED },
        }),
      );
    });

    it("should return 201 and call insertResultStatusCommand when status is TEST_PROCESSED", async () => {
      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(201);
      expect(mockInsertResultStatusCommand).toHaveBeenCalledWith(
        MOCK_ORDER_UID,
        expect.any(String),
        MOCK_CORRELATION_ID,
      );
      expect(mockNotify).not.toHaveBeenCalled();
      expect(mockHandleReminderOrderStatusUpdated).not.toHaveBeenCalled();
    });

    it("should still return 201 when insertResultStatusCommand throws", async () => {
      mockInsertResultStatusCommand.mockRejectedValueOnce(new Error("Result status insert failed"));

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(201);
      expect(mockNotify).not.toHaveBeenCalled();
      expect(mockHandleReminderOrderStatusUpdated).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should return 500 with OperationOutcome for database errors", async () => {
      mockGetPatientIdFromOrder.mockRejectedValueOnce(new Error("Database connection failed"));

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(500);

      const body = JSON.parse(result.body);

      expect(body.resourceType).toBe("OperationOutcome");
      expect(body.issue[0].severity).toBe("fatal");
      expect(body.issue[0].code).toBe("exception");
    });

    it("should return 500 with OperationOutcome for unexpected errors", async () => {
      mockCheckIdempotency.mockRejectedValueOnce(new Error("Unexpected error"));

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(500);

      const body = JSON.parse(result.body);

      expect(body.resourceType).toBe("OperationOutcome");
      expect(body.issue[0].severity).toBe("fatal");
    });
  });
});
