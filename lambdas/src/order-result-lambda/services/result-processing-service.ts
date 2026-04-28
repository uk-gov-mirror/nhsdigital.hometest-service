import { Observation } from "fhir/r4";

import { HttpClient } from "../../lib/http/http-client";

export interface ProcessValidatedResultInput {
  correlationId: string;
  observation: Observation;
}

export interface ResultProcessingService {
  processValidatedResult(input: ProcessValidatedResultInput): Promise<void>;
}

export class ResultProcessingHandoffService implements ResultProcessingService {
  constructor(private readonly httpClient: HttpClient) {}

  async processValidatedResult({
    correlationId,
    observation,
  }: ProcessValidatedResultInput): Promise<void> {
    await this.httpClient.post<void>(
      "hiv-result-processor",
      observation,
      { "x-correlation-id": correlationId },
      "application/fhir+json",
    );
  }
}
