import { LambdaClient } from "@aws-sdk/client-lambda";

import { LambdaHttpClient } from "../lib/http/lambda-http-client";
import { buildEnvironment } from "./init";
import { ResultStatusLambdaService } from "./services/result-status-lambda-service";

jest.mock("@aws-sdk/client-lambda");
jest.mock("../lib/http/lambda-http-client");
jest.mock("./services/result-status-lambda-service");

describe("hiv-results-processor init", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };

    process.env.AWS_REGION = "eu-west-2";
    process.env.RESULT_STATUS_LAMBDA_NAME = "status-lambda";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("initializes resultStatusLambdaService", () => {
    const env = buildEnvironment();

    expect(env.resultStatusLambdaService).toBeInstanceOf(ResultStatusLambdaService);
  });

  it("constructs LambdaClient with AWS_REGION", () => {
    buildEnvironment();

    expect(LambdaClient).toHaveBeenCalledWith(expect.objectContaining({ region: "eu-west-2" }));
  });

  it("constructs LambdaHttpClient with the LambdaClient instance and RESULT_STATUS_LAMBDA_NAME", () => {
    buildEnvironment();

    const lambdaClientInstance = (LambdaClient as jest.Mock).mock.instances[0];
    expect(LambdaHttpClient).toHaveBeenCalledWith(lambdaClientInstance, "status-lambda");
  });

  it("passes LambdaHttpClient instance to ResultStatusLambdaService", () => {
    buildEnvironment();

    const lambdaHttpClientInstance = (LambdaHttpClient as jest.Mock).mock.instances[0];
    expect(ResultStatusLambdaService).toHaveBeenCalledWith(lambdaHttpClientInstance);
  });

  it("throws if AWS_REGION is missing", () => {
    delete process.env.AWS_REGION;

    expect(() => buildEnvironment()).toThrow(
      "Missing value for an environment variable AWS_REGION",
    );
  });

  it("throws if RESULT_STATUS_LAMBDA_NAME is missing", () => {
    delete process.env.RESULT_STATUS_LAMBDA_NAME;

    expect(() => buildEnvironment()).toThrow(
      "Missing value for an environment variable RESULT_STATUS_LAMBDA_NAME",
    );
  });

  it("returns the same instance on repeated calls (singleton)", () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { init: isolatedInit } = require("./init");

      const env1 = isolatedInit();
      const env2 = isolatedInit();

      expect(env1).toBe(env2);
      expect(ResultStatusLambdaService).toHaveBeenCalledTimes(1);
    });
  });

  it("allows retry if buildEnvironment throws the first time", () => {
    jest.isolateModules(() => {
      jest.clearAllMocks();

      (ResultStatusLambdaService as jest.Mock).mockImplementationOnce(() => {
        throw new Error("Boom");
      });

      const { init: isolatedInit } = require("./init");

      expect(() => isolatedInit()).toThrow("Boom");

      const env = isolatedInit();
      expect(env).toBeTruthy();
    });
  });
});
