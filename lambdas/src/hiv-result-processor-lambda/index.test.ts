import { APIGatewayProxyEvent } from "aws-lambda";

import { createFhirErrorResponse } from "../lib/fhir-response";
import { lambdaHandler } from "./index";
import { InterpretationCode } from "./models/interpretation";

jest.mock("./init", () => {
  const initMock = {
    resultStatusLambdaService: {
      sendResult: jest.fn(),
    },
  };
  return {
    init: () => initMock,
    initMock,
  };
});

jest.mock("./builders/task-builder", () => ({
  buildTaskFromObservation: jest.fn(() => ({ mockTask: true })),
}));

jest.mock("../lib/fhir-observation-extractors", () => ({
  extractInterpretationCodeFromFHIRObservation: jest.fn(),
}));

jest.mock("../lib/fhir-response", () => ({
  createFhirErrorResponse: jest.fn((code, type, message, severity) => ({
    statusCode: code,
    body: JSON.stringify({
      issue: [{ code: type, diagnostics: message, severity }],
    }),
  })),
  createFhirResponse: jest.fn((code, resource) => ({
    statusCode: code,
    body: JSON.stringify(resource),
  })),
}));

const { initMock } = jest.requireMock("./init");
const { buildTaskFromObservation } = jest.requireMock("./builders/task-builder");
const { extractInterpretationCodeFromFHIRObservation } = jest.requireMock(
  "../lib/fhir-observation-extractors",
);

describe("hiv-results-processor handler", () => {
  const observation = { resourceType: "Observation" };

  const event: APIGatewayProxyEvent = {
    path: "/hiv",
    httpMethod: "POST",
    body: JSON.stringify(observation),
    headers: { "X-Correlation-Id": "550e8400-e29b-41d4-a716-446655440003" },
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    queryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: "",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 for missing correlation ID", async () => {
    const noCorrelationEvent = { ...event, headers: {} };

    const res = await lambdaHandler(noCorrelationEvent as any);

    expect(res.statusCode).toBe(400);
    expect(createFhirErrorResponse).toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON", async () => {
    const badEvent = { ...event, body: "{invalid json" };

    const res = await lambdaHandler(badEvent as any);

    expect(res.statusCode).toBe(400);
    expect(createFhirErrorResponse).toHaveBeenCalled();
  });

  it("returns 400 when body is null", async () => {
    const nullBodyEvent = { ...event, body: null };

    const res = await lambdaHandler(nullBodyEvent as any);

    expect(res.statusCode).toBe(400);
    expect(createFhirErrorResponse).toHaveBeenCalled();
  });

  it("returns 200 and ignores reactive results", async () => {
    extractInterpretationCodeFromFHIRObservation.mockReturnValue(InterpretationCode.Abnormal);

    const res = await lambdaHandler(event);

    expect(res.statusCode).toBe(200);
    expect(initMock.resultStatusLambdaService.sendResult).not.toHaveBeenCalled();
  });

  it("builds task and calls status lambda for negative results", async () => {
    extractInterpretationCodeFromFHIRObservation.mockReturnValue(InterpretationCode.Normal);

    const res = await lambdaHandler(event);

    expect(buildTaskFromObservation).toHaveBeenCalledWith(observation);
    expect(initMock.resultStatusLambdaService.sendResult).toHaveBeenCalledWith(
      { mockTask: true },
      event.headers["X-Correlation-Id"],
    );
    expect(res.statusCode).toBe(200);
  });

  it("returns 500 if status lambda invocation fails", async () => {
    extractInterpretationCodeFromFHIRObservation.mockReturnValue(InterpretationCode.Normal);
    initMock.resultStatusLambdaService.sendResult.mockRejectedValueOnce(new Error("fail"));

    const res = await lambdaHandler(event);

    expect(res.statusCode).toBe(500);
    expect(createFhirErrorResponse).toHaveBeenCalled();
  });

  it("returns 200 without calling status lambda for unknown interpretation codes", async () => {
    extractInterpretationCodeFromFHIRObservation.mockReturnValue("U");

    const res = await lambdaHandler(event);

    expect(res.statusCode).toBe(200);
    expect(initMock.resultStatusLambdaService.sendResult).not.toHaveBeenCalled();
  });
});
