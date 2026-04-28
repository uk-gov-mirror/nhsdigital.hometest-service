import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

import { HttpClient, HttpError } from "./http-client";

const buildApiGatewayEvent = (
  method: "GET" | "POST",
  path: string,
  headers: Record<string, string>,
  body: string | null,
): Partial<APIGatewayProxyEvent> => ({
  httpMethod: method,
  path,
  headers,
  body,
  multiValueHeaders: {},
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  pathParameters: null,
  stageVariables: null,
  requestContext: {} as APIGatewayProxyEvent["requestContext"],
  resource: "",
  isBase64Encoded: false,
});

const decodePayload = (payload: Uint8Array | undefined): APIGatewayProxyResult => {
  if (!payload) {
    throw new HttpError("Lambda invocation returned no payload", 500);
  }
  return JSON.parse(Buffer.from(payload).toString("utf-8")) as APIGatewayProxyResult;
};

const serializeBody = (body: unknown): string | null => {
  if (body == null) return null;
  if (typeof body === "string") return body;
  return JSON.stringify(body);
};

export class LambdaHttpClient implements HttpClient {
  constructor(
    private readonly client: LambdaClient,
    private readonly functionName: string,
  ) {}

  async get<T>(url: string, headers?: Record<string, string>): Promise<T> {
    const event = buildApiGatewayEvent(
      "GET",
      url,
      { Accept: "application/json", ...headers },
      null,
    );

    const result = await this.invoke(event, url);

    const { statusCode, body } = result;
    if (statusCode < 200 || statusCode >= 300) {
      throw new HttpError(
        `HTTP GET: Error response from ${this.functionName} ${url}`,
        statusCode,
        body,
      );
    }

    return JSON.parse(body) as T;
  }

  async post<T>(
    url: string,
    body: unknown,
    headers: Record<string, string> = {},
    contentType: string = "application/json",
  ): Promise<T> {
    const result = await this.executePost(url, body, headers, contentType);
    return JSON.parse(result.body) as T;
  }

  async postRaw(
    url: string,
    body: unknown,
    headers: Record<string, string> = {},
    contentType: string = "application/json",
  ): Promise<Response> {
    const result = await this.executePost(url, body, headers, contentType);
    return new Response(result.body, {
      status: result.statusCode,
      headers: result.headers as Record<string, string>,
    });
  }

  private async invoke(
    event: Partial<APIGatewayProxyEvent>,
    url: string,
  ): Promise<APIGatewayProxyResult> {
    const command = new InvokeCommand({
      FunctionName: this.functionName,
      InvocationType: "RequestResponse",
      Payload: Buffer.from(JSON.stringify(event)),
    });

    const response = await this.client.send(command);

    if (response.FunctionError) {
      throw new HttpError(`Error sending request to ${this.functionName} ${url}`, 500);
    }

    return decodePayload(response.Payload);
  }

  private async executePost(
    url: string,
    body: unknown,
    headers: Record<string, string>,
    contentType: string,
  ): Promise<APIGatewayProxyResult> {
    const event = buildApiGatewayEvent(
      "POST",
      url,
      { Accept: "application/json", "Content-Type": contentType, ...headers },
      serializeBody(body),
    );

    const result = await this.invoke(event, url);

    const { statusCode, body: resultBody } = result;
    if (statusCode < 200 || statusCode >= 300) {
      throw new HttpError(
        `HTTP POST: Error response from ${this.functionName} ${url}`,
        statusCode,
        resultBody,
      );
    }

    return result;
  }
}
