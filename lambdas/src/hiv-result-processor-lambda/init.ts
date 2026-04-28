import { LambdaClient } from "@aws-sdk/client-lambda";

import { getAwsClientOptions } from "../lib/aws/aws-client-config";
import { LambdaHttpClient } from "../lib/http/lambda-http-client";
import { retrieveMandatoryEnvVariable } from "../lib/utils/utils";
import { ResultStatusLambdaService } from "./services/result-status-lambda-service";

export interface Environment {
  resultStatusLambdaService: ResultStatusLambdaService;
}

export function buildEnvironment(): Environment {
  const awsRegion = retrieveMandatoryEnvVariable("AWS_REGION");
  const resultStatusLambdaName = retrieveMandatoryEnvVariable("RESULT_STATUS_LAMBDA_NAME");
  const lambdaClient = new LambdaClient(getAwsClientOptions(awsRegion));
  const lambdaHttpClient = new LambdaHttpClient(lambdaClient, resultStatusLambdaName);
  const resultStatusLambdaService = new ResultStatusLambdaService(lambdaHttpClient);

  return {
    resultStatusLambdaService,
  };
}

let _env: Environment | undefined;

export function init(): Environment {
  _env ??= buildEnvironment();
  return _env;
}
