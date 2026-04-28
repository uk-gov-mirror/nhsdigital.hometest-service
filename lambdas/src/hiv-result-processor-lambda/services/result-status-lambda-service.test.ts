import { HttpClient } from "../../lib/http/http-client";
import { type FHIRTask } from "../../lib/models/fhir/fhir-service-request-type";
import { ResultStatusLambdaService } from "./result-status-lambda-service";

const mockPost = jest.fn();
const mockHttpClient: HttpClient = {
  get: jest.fn(),
  post: mockPost,
  postRaw: jest.fn(),
};

describe("ResultStatusLambdaService", () => {
  const taskPayload: FHIRTask = {
    resourceType: "Task",
    status: "completed",
    intent: "order",
    identifier: [
      {
        system: "https://fhir.hometest.nhs.uk/Id/order-id",
        value: "550e8400-e29b-41d4-a716-446655440000",
      },
    ],
    basedOn: [{ reference: "ServiceRequest/550e8400-e29b-41d4-a716-446655440000" }],
    for: { reference: "Patient/550e8400-e29b-41d4-a716-446655440001" },
  };

  const correlationId = "test-correlation-id";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("posts the task payload to the correct path with the correlation ID header", async () => {
    mockPost.mockResolvedValueOnce({});
    const service = new ResultStatusLambdaService(mockHttpClient);

    await service.sendResult(taskPayload, correlationId);

    expect(mockPost).toHaveBeenCalledWith(
      "result/status",
      taskPayload,
      { "X-Correlation-ID": correlationId },
      "application/fhir+json",
    );
  });

  it("uses empty string as correlation ID when none is provided", async () => {
    mockPost.mockResolvedValueOnce(undefined);
    const service = new ResultStatusLambdaService(mockHttpClient);

    await service.sendResult(taskPayload, "");

    expect(mockPost).toHaveBeenCalledWith(
      "result/status",
      taskPayload,
      { "X-Correlation-ID": "" },
      "application/fhir+json",
    );
  });

  it("throws an error when the post fails", async () => {
    const error = new Error("Network failure");
    mockPost.mockRejectedValueOnce(error);
    const service = new ResultStatusLambdaService(mockHttpClient);

    await expect(service.sendResult(taskPayload, correlationId)).rejects.toThrow("Network failure");
  });
});
