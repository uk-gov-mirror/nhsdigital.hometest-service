import { LambdaClient } from "@aws-sdk/client-lambda";
import { APIGatewayProxyResult } from "aws-lambda";

import { HttpError } from "./http-client";
import { LambdaHttpClient } from "./lambda-http-client";

const mockSend = jest.fn();
const mockLambdaClient = { send: mockSend } as unknown as LambdaClient;

const encodeResult = (result: APIGatewayProxyResult): Uint8Array =>
  Buffer.from(JSON.stringify(result));

describe("LambdaHttpClient", () => {
  let client: LambdaHttpClient;

  beforeEach(() => {
    client = new LambdaHttpClient(mockLambdaClient, "my-lambda");
    jest.clearAllMocks();
  });

  describe("get", () => {
    it("returns parsed JSON body on a 2xx response", async () => {
      mockSend.mockResolvedValueOnce({
        Payload: encodeResult({ statusCode: 200, headers: {}, body: JSON.stringify({ ok: true }) }),
      });

      const result = await client.get<{ ok: boolean }>("/some-path");

      expect(result).toEqual({ ok: true });
    });

    it("sends a GET event with the correct shape", async () => {
      mockSend.mockResolvedValueOnce({
        Payload: encodeResult({
          statusCode: 200,
          headers: {},
          body: JSON.stringify({
            some: "thing",
          }),
        }),
      });

      const response = await client.get("/some-path", { "X-Correlation-ID": "abc-123" });

      expect(response).toEqual({ some: "thing" });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            FunctionName: "my-lambda",
            InvocationType: "RequestResponse",
          }),
        }),
      );

      const payloadArg = mockSend.mock.calls[0][0].input.Payload;
      const payloadString =
        typeof payloadArg === "string"
          ? payloadArg
          : Buffer.from(payloadArg as Uint8Array).toString("utf-8");
      const sentPayload = JSON.parse(payloadString);

      expect(sentPayload).toMatchObject({
        httpMethod: "GET",
        path: "/some-path",
        headers: expect.objectContaining({
          Accept: "application/json",
          "X-Correlation-ID": "abc-123",
        }),
        body: null,
      });
    });

    it("throws HttpError with status when response is non-2xx", async () => {
      mockSend.mockResolvedValueOnce({
        Payload: encodeResult({ statusCode: 404, headers: {}, body: "Not found" }),
      });

      await expect(client.get("/some-path")).rejects.toEqual(
        expect.objectContaining<Partial<HttpError>>({
          name: "HttpError",
          status: 404,
        }),
      );
    });

    it("throws HttpError 500 when FunctionError is set", async () => {
      mockSend.mockResolvedValueOnce({
        FunctionError: "Unhandled",
        Payload: encodeResult({ statusCode: 500, headers: {}, body: "" }),
      });

      await expect(client.get("/some-path")).rejects.toEqual(
        expect.objectContaining<Partial<HttpError>>({
          name: "HttpError",
          status: 500,
        }),
      );
    });

    it("throws HttpError 500 when Payload is undefined", async () => {
      mockSend.mockResolvedValueOnce({ Payload: undefined });

      await expect(client.get("/some-path")).rejects.toEqual(
        expect.objectContaining<Partial<HttpError>>({
          name: "HttpError",
          status: 500,
        }),
      );
    });
  });

  describe("post", () => {
    it("returns parsed JSON body on a 2xx response", async () => {
      mockSend.mockResolvedValueOnce({
        Payload: encodeResult({
          statusCode: 201,
          headers: {},
          body: JSON.stringify({ id: "123" }),
        }),
      });

      const result = await client.post<{ id: string }>("/some-path", { foo: "bar" });

      expect(result).toEqual({ id: "123" });
    });

    it("sends a POST event with the correct shape and serialised body", async () => {
      mockSend.mockResolvedValueOnce({
        Payload: encodeResult({ statusCode: 200, headers: {}, body: JSON.stringify({}) }),
      });

      await client.post("/some-path", { foo: "bar" }, { "X-Correlation-ID": "abc-123" });

      const sentPayload = JSON.parse(mockSend.mock.calls[0][0].input.Payload);
      expect(sentPayload).toMatchObject({
        httpMethod: "POST",
        path: "/some-path",
        headers: expect.objectContaining({
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Correlation-ID": "abc-123",
        }),
        body: JSON.stringify({ foo: "bar" }),
      });
    });

    it("uses provided contentType header", async () => {
      mockSend.mockResolvedValueOnce({
        Payload: encodeResult({ statusCode: 200, headers: {}, body: JSON.stringify({}) }),
      });

      await client.post("/some-path", "raw=value", {}, "application/x-www-form-urlencoded");

      const sentPayload = JSON.parse(mockSend.mock.calls[0][0].input.Payload);
      expect(sentPayload.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    });

    it("throws HttpError with status when response is non-2xx", async () => {
      mockSend.mockResolvedValueOnce({
        Payload: encodeResult({ statusCode: 400, headers: {}, body: "bad request" }),
      });

      await expect(client.post("/some-path", {})).rejects.toEqual(
        expect.objectContaining<Partial<HttpError>>({
          name: "HttpError",
          status: 400,
        }),
      );
    });

    it("throws HttpError 500 when FunctionError is set", async () => {
      mockSend.mockResolvedValueOnce({
        FunctionError: "Unhandled",
        Payload: encodeResult({ statusCode: 500, headers: {}, body: "" }),
      });

      await expect(client.post("/some-path", {})).rejects.toEqual(
        expect.objectContaining<Partial<HttpError>>({ name: "HttpError", status: 500 }),
      );
    });
  });

  describe("postRaw", () => {
    it("returns a Response with the correct status and body on 2xx", async () => {
      mockSend.mockResolvedValueOnce({
        Payload: encodeResult({ statusCode: 200, headers: {}, body: "raw body" }),
      });

      const result = await client.postRaw("/some-path", "payload");

      expect(result.status).toBe(200);
      expect(await result.text()).toBe("raw body");
    });

    it("throws HttpError with status when response is non-2xx", async () => {
      mockSend.mockResolvedValueOnce({
        Payload: encodeResult({ statusCode: 502, headers: {}, body: "bad gateway" }),
      });

      await expect(client.postRaw("/some-path", "payload")).rejects.toEqual(
        expect.objectContaining<Partial<HttpError>>({
          name: "HttpError",
          status: 502,
        }),
      );
    });

    it("throws HttpError 500 when FunctionError is set", async () => {
      mockSend.mockResolvedValueOnce({
        FunctionError: "Unhandled",
        Payload: encodeResult({ statusCode: 500, headers: {}, body: "" }),
      });

      await expect(client.postRaw("/some-path", "payload")).rejects.toEqual(
        expect.objectContaining<Partial<HttpError>>({ name: "HttpError", status: 500 }),
      );
    });
  });
});
