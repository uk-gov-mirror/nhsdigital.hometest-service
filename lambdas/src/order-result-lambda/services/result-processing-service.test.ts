import { Observation } from "fhir/r4";

import { type HttpClient } from "../../lib/http/http-client";
import { ResultProcessingHandoffService } from "./result-processing-service";

describe("ResultProcessingHandoffService", () => {
  const correlationId = "550e8400-e29b-41d4-a716-446655440002";
  const observation: Observation = {
    resourceType: "Observation",
    status: "final",
    code: {},
    valueString: "Negative",
  };

  const mockHttpClient: jest.Mocked<HttpClient> = {
    get: jest.fn(),
    post: jest.fn(),
    postRaw: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("posts the observation to the result processing lambda with the correlation ID header", async () => {
    mockHttpClient.post.mockResolvedValue(undefined);
    const service = new ResultProcessingHandoffService(mockHttpClient);

    await service.processValidatedResult({ correlationId, observation });

    expect(mockHttpClient.post).toHaveBeenCalledWith(
      "hiv-result-processor",
      observation,
      { "x-correlation-id": correlationId },
      "application/fhir+json",
    );
  });

  it("propagates errors thrown by the http client", async () => {
    mockHttpClient.post.mockRejectedValue(new Error("invocation failed"));
    const service = new ResultProcessingHandoffService(mockHttpClient);

    await expect(service.processValidatedResult({ correlationId, observation })).rejects.toThrow(
      "invocation failed",
    );
  });
});
