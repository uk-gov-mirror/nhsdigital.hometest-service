import { LambdaClient } from "@aws-sdk/client-lambda";

import { getAwsClientOptions } from "../lib/aws/aws-client-config";
import { PostgresDbClient } from "../lib/db/db-client";
import { postgresConfigFromEnv } from "../lib/db/db-config";
import { OrderService } from "../lib/db/order-db";
import { LambdaHttpClient } from "../lib/http/lambda-http-client";
import { AwsSecretsClient } from "../lib/secrets/secrets-manager-client";
import { retrieveMandatoryEnvVariable } from "../lib/utils/utils";
import {
  ResultProcessingHandoffService,
  ResultProcessingService,
} from "./services/result-processing-service";

export interface Environment {
  orderService: OrderService;
  resultProcessingService: ResultProcessingService;
}

export function buildEnvironment(): Environment {
  const awsRegion = retrieveMandatoryEnvVariable("AWS_REGION");
  const resultProcessingLambdaName = retrieveMandatoryEnvVariable("RESULT_PROCESSING_LAMBDA_NAME");

  const secretsClient = new AwsSecretsClient(awsRegion);
  const dbClient = new PostgresDbClient(postgresConfigFromEnv(secretsClient));
  const orderService = new OrderService(dbClient);
  const lambdaClient = new LambdaClient(getAwsClientOptions(awsRegion));
  const httpClient = new LambdaHttpClient(lambdaClient, resultProcessingLambdaName);
  const resultProcessingService = new ResultProcessingHandoffService(httpClient);

  return {
    orderService,
    resultProcessingService,
  };
}

let _env: Environment | undefined;

export function init(): Environment {
  _env ??= buildEnvironment();
  return _env;
}
