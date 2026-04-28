import { LambdaClient } from "@aws-sdk/client-lambda";

import { PostgresDbClient } from "../lib/db/db-client";
import { postgresConfigFromEnv } from "../lib/db/db-config";
import { OrderService } from "../lib/db/order-db";
import { LambdaHttpClient } from "../lib/http/lambda-http-client";
import { AwsSecretsClient } from "../lib/secrets/secrets-manager-client";
import { buildEnvironment as init } from "./init";
import { ResultProcessingHandoffService } from "./services/result-processing-service";

jest.mock("@aws-sdk/client-lambda");
jest.mock("../lib/db/db-client");
jest.mock("../lib/db/db-config");
jest.mock("../lib/commons");
jest.mock("../lib/secrets/secrets-manager-client");
jest.mock("../lib/sqs/sqs-client");
jest.mock("../lib/notify/services/order-status-notify-service");
jest.mock("../lib/http/lambda-http-client");

describe("order-result-lambda init", () => {
  const originalEnv = process.env;

  const mockEnvVariables = {
    DB_USERNAME: "test-username",
    DB_ADDRESS: "test-address",
    DB_PORT: "5432",
    DB_NAME: "test-database",
    DB_SCHEMA: "test-schema",
    DB_SECRET_NAME: "test-secret-name",
    AWS_REGION: "eu-west-2",
    RESULT_PROCESSING_FUNCTION_NAME: "hometest-service-hiv-results-processor",
  };

  const mockPostgresConfig = {
    user: "test-user",
    host: "test-host",
    port: 5432,
    database: "test-db",
    password: jest.fn().mockResolvedValue("test-password"),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    Object.assign(process.env, mockEnvVariables);
    (postgresConfigFromEnv as jest.Mock).mockReturnValue(mockPostgresConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("initializes the lambda environment with direct result processing handoff", () => {
    const result = init();

    expect(result).toHaveProperty("orderService");
    expect(result).toHaveProperty("resultProcessingService");
    expect(result.orderService).toBeInstanceOf(OrderService);
    expect(result.resultProcessingService).toBeInstanceOf(ResultProcessingHandoffService);
  });

  it("creates AwsSecretsClient with AWS_REGION when set", () => {
    process.env.AWS_REGION = "us-east-1";

    init();

    expect(AwsSecretsClient).toHaveBeenCalledWith("us-east-1");
  });

  it("throws when AWS_REGION is not set", () => {
    delete process.env.AWS_REGION;

    expect(() => init()).toThrow("Missing value for an environment variable AWS_REGION");
  });

  it("throws when RESULT_PROCESSING_FUNCTION_NAME is not set", () => {
    delete process.env.RESULT_PROCESSING_FUNCTION_NAME;

    expect(() => init()).toThrow(
      "Missing value for an environment variable RESULT_PROCESSING_FUNCTION_NAME",
    );
  });

  it("creates PostgresDbClient with correct configuration", () => {
    init();

    expect(PostgresDbClient).toHaveBeenCalledWith(mockPostgresConfig);
  });

  it("creates a LambdaClient with the AWS region", () => {
    init();
    expect(LambdaClient).toHaveBeenCalledWith(expect.objectContaining({ region: "eu-west-2" }));
  });

  it("constructs LambdaHttpClient with the LambdaClient instance and RESULT_PROCESSING_FUNCTION_NAME", () => {
    init();

    const lambdaClientInstance = (LambdaClient as jest.Mock).mock.instances[0];
    expect(LambdaHttpClient).toHaveBeenCalledWith(
      lambdaClientInstance,
      "hometest-service-hiv-results-processor",
    );
  });

  it("returns an Environment object with all required properties", () => {
    const result = init();

    expect(result).toEqual({
      orderService: expect.any(OrderService),
      resultProcessingService: expect.any(ResultProcessingHandoffService),
    });
  });

  describe("singleton protection", () => {
    it("constructs dependencies once no matter how many times init() is called", () => {
      jest.isolateModules(() => {
        jest.clearAllMocks();
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { init: singletonInit } = require("./init");

        const env1 = singletonInit();
        const env2 = singletonInit();

        expect(PostgresDbClient).toHaveBeenCalledTimes(1);
        expect(env1).toBe(env2);
      });
    });
  });

  describe("rejection retry", () => {
    it("allows retry after buildEnvironment throws", () => {
      jest.isolateModules(() => {
        jest.clearAllMocks();
        (PostgresDbClient as jest.Mock).mockImplementationOnce(() => {
          throw new Error("DB connection failed");
        });
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { init: singletonInit } = require("./init");

        expect(() => singletonInit()).toThrow("DB connection failed");

        const result = singletonInit();
        expect(result).toBeTruthy();
      });
    });
  });
});
