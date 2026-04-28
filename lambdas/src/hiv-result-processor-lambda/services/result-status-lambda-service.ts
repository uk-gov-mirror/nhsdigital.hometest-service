import { HttpClient } from "src/lib/http/http-client";

import { type FHIRTask } from "../../lib/models/fhir/fhir-service-request-type";

export class ResultStatusLambdaService {
  constructor(private readonly client: HttpClient) {}

  async sendResult(result: FHIRTask, correlationId: string): Promise<void> {
    await this.client.post<void>(
      "result/status",
      result,
      { "X-Correlation-ID": correlationId },
      "application/fhir+json",
    );
  }
}
