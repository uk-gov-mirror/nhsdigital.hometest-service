import { APIGatewayProxyEvent } from "aws-lambda";

import { validateAndExtractCorrelationId } from "./correlation-id-validation";

const mockGetCorrelationIdFromEventHeaders = jest.fn();

jest.mock("../../lib/utils/utils", () => ({
  ...jest.requireActual("../../lib/utils/utils"),
  getCorrelationIdFromEventHeaders: () => mockGetCorrelationIdFromEventHeaders(),
}));

const MOCK_CORRELATION_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("validateAndExtractCorrelationId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return success with the correlation ID when the header is present and valid", () => {
    mockGetCorrelationIdFromEventHeaders.mockReturnValue(MOCK_CORRELATION_ID);

    const result = validateAndExtractCorrelationId({} as APIGatewayProxyEvent);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(MOCK_CORRELATION_ID);
    }
  });

  it("should return error with the thrown error message when the correlation ID header is missing or invalid", () => {
    const errorMessage = "Correlation ID is missing or invalid";
    mockGetCorrelationIdFromEventHeaders.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    const result = validateAndExtractCorrelationId({} as APIGatewayProxyEvent);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errorCode).toBe(400);
      expect(result.error.errorType).toBe("invalid");
      expect(result.error.errorMessage).toBe(errorMessage);
    }
  });

  it("should return a generic error message when a non-Error value is thrown", () => {
    mockGetCorrelationIdFromEventHeaders.mockImplementation(() => {
      throw "unexpected string error";
    });

    const result = validateAndExtractCorrelationId({} as APIGatewayProxyEvent);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errorCode).toBe(400);
      expect(result.error.errorMessage).toBe("Invalid correlation ID");
    }
  });
});
