import { APIGatewayProxyEvent, Context } from "aws-lambda";

import { IdempotencyCheckResult } from "../lib/db/order-status-db";
import { OrderStatusFHIRTask } from "./index";
import { IncomingBusinessStatus } from "./types";
import { businessStatusMapping } from "./utils";

const mockInit = jest.fn();

const mockGetPatientIdFromOrder = jest.fn();
const mockCheckIdempotency = jest.fn();
const mockAddOrderStatusUpdate = jest.fn();
const mockNotify = jest.fn();
const mockHandleReminderOrderStatusUpdated = jest.fn();

const mockGetCorrelationIdFromEventHeaders = jest.fn();

jest.mock("./init", () => ({
  init: mockInit,
}));

jest.mock("../lib/utils/utils", () => ({
  ...jest.requireActual("../lib/utils/utils"),
  getCorrelationIdFromEventHeaders: () => mockGetCorrelationIdFromEventHeaders(),
}));

const MOCK_CORRELATION_ID = "123e4567-e89b-12d3-a456-426614174000";
const MOCK_ORDER_UID = "550e8400-e29b-41d4-a716-446655440000";
const MOCK_PATIENT_UID = "patient-123";
const MOCK_BUSINESS_STATUS = IncomingBusinessStatus.DISPATCHED;

describe("Order Status Lambda Handler", () => {
  let handler: (event: APIGatewayProxyEvent, context: Context) => Promise<any>;
  let mockEvent: Partial<APIGatewayProxyEvent>;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    mockEvent = {};

    mockGetCorrelationIdFromEventHeaders.mockReturnValue(MOCK_CORRELATION_ID);
    mockGetPatientIdFromOrder.mockResolvedValue(MOCK_PATIENT_UID);
    mockCheckIdempotency.mockResolvedValue({ isDuplicate: false });
    mockAddOrderStatusUpdate.mockResolvedValue(undefined);
    mockNotify.mockResolvedValue(undefined);
    mockHandleReminderOrderStatusUpdated.mockResolvedValue(undefined);

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
    });

    const module = await import("./index");

    handler = module.lambdaHandler;
  });

  const validTaskBody: OrderStatusFHIRTask = {
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

  describe("Request Parsing and Validation", () => {
    it("should return 400 if request body is empty JSON object", async () => {
      mockEvent.body = "{}";

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);

      expect(body.resourceType).toBe("OperationOutcome");
      expect(body.issue[0].code).toBe("invalid");

      expect(body.issue[0].diagnostics).toMatch(/identifier|lastModified|businessStatus/);
    });

    it("should return 400 if request body is null", async () => {
      mockEvent.body = null;

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);

      expect(body.resourceType).toBe("OperationOutcome");
      expect(body.issue[0].code).toBe("invalid");
      expect(body.issue[0].diagnostics).toMatch(/Request body is required/);
    });

    it("should return 400 if request body is invalid JSON", async () => {
      mockEvent.body = "{invalid json";

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(400);

      const body = JSON.parse(result.body);

      expect(body.resourceType).toBe("OperationOutcome");
    });

    it("should return 400 if Task schema validation fails", async () => {
      mockEvent.body = JSON.stringify({
        resourceType: "Task",
        status: "in-progress",
        for: {
          reference: `Patient/${MOCK_PATIENT_UID}`,
        },
        businessStatus: {
          text: "invalid-business-status",
        },
      } satisfies Partial<Omit<OrderStatusFHIRTask, "identifier">>);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(400);

      const body = JSON.parse(result.body);

      expect(body.resourceType).toBe("OperationOutcome");
      expect(body.issue[0].code).toBe("invalid");
    });
  });

  describe("Order Existence", () => {
    it("should return 404 when order does not exist", async () => {
      mockGetPatientIdFromOrder.mockResolvedValueOnce(null);
      mockEvent.body = JSON.stringify(validTaskBody);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(404);

      const body = JSON.parse(result.body);

      expect(body.resourceType).toBe("OperationOutcome");
      expect(body.issue[0].code).toBe("not-found");
      expect(body.issue[0].diagnostics).toContain("not found");
    });

    it("should proceed when order exists", async () => {
      mockGetPatientIdFromOrder.mockResolvedValueOnce(MOCK_PATIENT_UID);
      mockEvent.body = JSON.stringify(validTaskBody);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(mockGetPatientIdFromOrder).toHaveBeenCalledWith(MOCK_ORDER_UID);
      expect(result.statusCode).toBe(201);
    });
  });

  describe("Patient Ownership", () => {
    it("should return 400 when patient reference format is invalid", async () => {
      mockEvent.body = JSON.stringify({
        ...validTaskBody,
        for: { reference: "invalid-ref" },
      } satisfies Partial<OrderStatusFHIRTask>);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(400);

      const body = JSON.parse(result.body);

      expect(body.issue[0].diagnostics).toContain("Invalid patient reference");
    });

    it("should return 400 when patient does not match order", async () => {
      mockEvent.body = JSON.stringify({
        ...validTaskBody,
        for: { reference: "Patient/other-patient" },
      } satisfies Partial<OrderStatusFHIRTask>);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(400);

      const body = JSON.parse(result.body);

      expect(body.resourceType).toBe("OperationOutcome");
      expect(body.issue[0].diagnostics).toContain("Patient ID does not match");
    });

    it("should proceed when patient matches order", async () => {
      mockEvent.body = JSON.stringify(validTaskBody);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(201);
    });
  });

  describe("Business Status Validation", () => {
    it("should return 400 for invalid business status", async () => {
      mockEvent.body = JSON.stringify({
        ...validTaskBody,
        businessStatus: {
          text: "INVALID_STATUS" as unknown as IncomingBusinessStatus,
        },
      } satisfies Partial<OrderStatusFHIRTask>);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(400);

      const body = JSON.parse(result.body);

      expect(body.issue[0].diagnostics).toContain("businessStatus");
    });

    it("should return 400 for missing business status", async () => {
      mockEvent.body = JSON.stringify({
        ...validTaskBody,
        businessStatus: undefined,
      } satisfies Partial<OrderStatusFHIRTask>);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(400);

      const body = JSON.parse(result.body);

      expect(body.issue[0].diagnostics).toContain("businessStatus");
    });

    it(`should accept ${IncomingBusinessStatus.DISPATCHED} business status`, async () => {
      mockEvent.body = JSON.stringify({
        ...validTaskBody,
        businessStatus: { text: IncomingBusinessStatus.DISPATCHED },
      } satisfies Partial<OrderStatusFHIRTask>);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(201);
    });

    it(`should accept ${IncomingBusinessStatus.ORDER_ACCEPTED} business status`, async () => {
      mockEvent.body = JSON.stringify({
        ...validTaskBody,
        businessStatus: { text: IncomingBusinessStatus.ORDER_ACCEPTED },
      } satisfies Partial<OrderStatusFHIRTask>);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(201);
    });

    it(`should accept ${IncomingBusinessStatus.RECEIVED_AT_LAB} business status`, async () => {
      mockEvent.body = JSON.stringify({
        ...validTaskBody,
        businessStatus: { text: IncomingBusinessStatus.RECEIVED_AT_LAB },
      } satisfies Partial<OrderStatusFHIRTask>);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(201);
    });
  });

  describe("Idempotency via Correlation ID", () => {
    it("should detect duplicate updates with same correlation ID", async () => {
      mockCheckIdempotency.mockResolvedValueOnce({
        isDuplicate: true,
      } satisfies Partial<IdempotencyCheckResult>);

      mockEvent.body = JSON.stringify(validTaskBody);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(200);
      expect(mockCheckIdempotency).toHaveBeenCalledWith(MOCK_ORDER_UID, MOCK_CORRELATION_ID);
      expect(mockHandleReminderOrderStatusUpdated).not.toHaveBeenCalled();
      expect(mockNotify).not.toHaveBeenCalled();
    });

    it("should process new updates with different correlation ID", async () => {
      const newCorrelationId = "mock-new-correlation-id-123";
      mockGetCorrelationIdFromEventHeaders.mockReturnValueOnce(newCorrelationId);

      mockCheckIdempotency.mockResolvedValueOnce({
        isDuplicate: false,
      } satisfies IdempotencyCheckResult);

      mockEvent.body = JSON.stringify(validTaskBody);
      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(201);

      expect(mockAddOrderStatusUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: newCorrelationId,
        }),
      );
    });

    it("should return 400 when there is no correlation id", async () => {
      mockEvent.headers = {};

      mockGetCorrelationIdFromEventHeaders.mockImplementation(() => {
        throw new Error("Correlation ID is missing or invalid");
      });

      mockEvent.body = JSON.stringify(validTaskBody);
      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(400);

      const body = JSON.parse(result.body);

      expect(body.issue[0].diagnostics).toMatch(/correlation id/i);
    });
  });

  describe("Timestamp Handling", () => {
    it("should accept when lastModified timestamp is older than latest update", async () => {
      const mockedLastModifiedTimestamp = "2024-01-15T08:00:00Z";

      mockEvent.body = JSON.stringify({
        ...validTaskBody,
        lastModified: mockedLastModifiedTimestamp, // Older than latest
      } satisfies Partial<OrderStatusFHIRTask>);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(201);

      expect(mockAddOrderStatusUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          createdAt: mockedLastModifiedTimestamp,
        }),
      );
    });

    it("should accept when lastModified timestamp is newer than latest update", async () => {
      const mockedLastModifiedTimestamp = "2024-01-15T11:00:00Z";

      mockEvent.body = JSON.stringify({
        ...validTaskBody,
        lastModified: mockedLastModifiedTimestamp, // Newer than latest
      } satisfies Partial<OrderStatusFHIRTask>);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(201);

      expect(mockAddOrderStatusUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          createdAt: mockedLastModifiedTimestamp,
        }),
      );
    });

    it("should reject when lastModified is missing", async () => {
      const { lastModified: _lastModified, ...bodyWithoutLastModified } = validTaskBody;

      mockEvent.body = JSON.stringify({
        ...bodyWithoutLastModified,
      } satisfies Partial<OrderStatusFHIRTask>);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(400);

      const body = JSON.parse(result.body);

      expect(body.issue[0].diagnostics).toContain("lastModified");
    });
  });

  describe("Successful Update", () => {
    it("should return 201 OK with updated Task when all validations pass", async () => {
      mockEvent.body = JSON.stringify(validTaskBody);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(201);
      expect(result.headers?.["Content-Type"]).toBe("application/fhir+json");

      const body = JSON.parse(result.body);

      expect(body.resourceType).toBe("Task");
      expect(body.status).toBe(validTaskBody.status);
      expect(body.for.reference).toBe(`Patient/${MOCK_PATIENT_UID}`);
    });

    it("should call addOrderStatusUpdate with correct parameters", async () => {
      mockEvent.body = JSON.stringify(validTaskBody);

      await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(mockAddOrderStatusUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: MOCK_ORDER_UID,
          statusCode: businessStatusMapping[MOCK_BUSINESS_STATUS],
          createdAt: validTaskBody.lastModified,
          correlationId: MOCK_CORRELATION_ID,
        }),
      );
    });

    it("should delegate post-update side effects to the notification service", async () => {
      mockEvent.body = JSON.stringify(validTaskBody);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(201);
      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: MOCK_PATIENT_UID,
          correlationId: MOCK_CORRELATION_ID,
          orderId: MOCK_ORDER_UID,
          statusCode: businessStatusMapping[MOCK_BUSINESS_STATUS],
        }),
      );
    });

    it("should still delegate non-dispatched statuses to the notification service", async () => {
      mockEvent.body = JSON.stringify({
        ...validTaskBody,
        businessStatus: {
          text: IncomingBusinessStatus.RECEIVED_AT_LAB,
        },
      } satisfies Partial<OrderStatusFHIRTask>);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(201);
      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: businessStatusMapping[IncomingBusinessStatus.RECEIVED_AT_LAB],
        }),
      );
    });

    it("should delegate confirmed statuses to the notification service", async () => {
      mockEvent.body = JSON.stringify({
        ...validTaskBody,
        businessStatus: {
          text: IncomingBusinessStatus.ORDER_ACCEPTED,
        },
      } satisfies Partial<OrderStatusFHIRTask>);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(201);
      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: businessStatusMapping[IncomingBusinessStatus.ORDER_ACCEPTED],
        }),
      );
    });

    it("should delegate reminder scheduling to the reminder service", async () => {
      mockEvent.body = JSON.stringify(validTaskBody);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(201);
      expect(mockHandleReminderOrderStatusUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: MOCK_ORDER_UID,
          correlationId: MOCK_CORRELATION_ID,
          statusCode: businessStatusMapping[MOCK_BUSINESS_STATUS],
          triggeredAt: validTaskBody.lastModified,
        }),
      );
    });

    it("should return 201 when notification service fails after a successful status update", async () => {
      mockNotify.mockRejectedValueOnce(new Error("Unexpected side effect error"));
      mockEvent.body = JSON.stringify(validTaskBody);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(201);
    });
  });

  describe("Error Handling", () => {
    it("should return OperationOutcome for validation errors", async () => {
      mockEvent.body = JSON.stringify({
        resourceType: "Task",
        // Invalid - missing required fields
      } satisfies Partial<OrderStatusFHIRTask>);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.resourceType).toBe("OperationOutcome");
      expect(body.issue[0].severity).toBe("error");
    });

    it("should return 500 with OperationOutcome for database errors", async () => {
      mockGetPatientIdFromOrder.mockRejectedValueOnce(new Error("Database connection failed"));

      mockEvent.body = JSON.stringify(validTaskBody);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(500);

      const body = JSON.parse(result.body);

      expect(body.resourceType).toBe("OperationOutcome");
      expect(body.issue[0].severity).toBe("fatal");
      expect(body.issue[0].code).toBe("exception");
    });

    it("should return 500 with OperationOutcome for unexpected errors", async () => {
      mockCheckIdempotency.mockRejectedValueOnce(new Error("Unexpected error"));

      mockEvent.body = JSON.stringify(validTaskBody);

      const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context);

      expect(result.statusCode).toBe(500);

      const body = JSON.parse(result.body);

      expect(body.resourceType).toBe("OperationOutcome");
      expect(body.issue[0].severity).toBe("fatal");
    });
  });
});
