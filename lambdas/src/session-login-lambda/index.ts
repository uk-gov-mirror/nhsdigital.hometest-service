import { randomUUID } from "node:crypto";

import middy from "@middy/core";
import cors from "@middy/http-cors";
import httpErrorHandler from "@middy/http-error-handler";
import httpSecurityHeaders from "@middy/http-security-headers";
import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from "aws-lambda";

import { securityHeaders } from "../lib/http/security-headers";
import { defaultCorsOptions } from "../lib/security/cors-configuration";
import { createJsonResponse, getCorrelationIdFromEventHeaders } from "../lib/utils/utils";
import { generateReadableError } from "../lib/utils/validation-utils";
import { buildPreviewAccessCookie, buildPreviewRefreshCookie } from "./cookies";
import { init } from "./init";
import { type SessionLoginBody, SessionLoginBodySchema } from "./schemas";
import { type SessionLoginErrorCode } from "./session-login-service";

const name = "session-login-lambda";

function resolveCorrelationId(event: APIGatewayProxyEvent): string {
  try {
    return getCorrelationIdFromEventHeaders(event);
  } catch (error) {
    const correlationId = randomUUID();
    const reason = error instanceof Error ? error.message : "Unknown correlation ID error";
    console.info(name, "Generated fallback correlation ID", { correlationId, reason });
    return correlationId;
  }
}

function parseBody(body: string | null): SessionLoginBody {
  if (body === null) {
    throw new Error("Body is required");
  }

  let parsedBody: unknown;

  try {
    parsedBody = JSON.parse(body);
  } catch (error) {
    throw new Error("Invalid JSON in request body", { cause: error });
  }

  const validationResult = SessionLoginBodySchema.safeParse(parsedBody);

  if (!validationResult.success) {
    throw new Error(`Validation failed: ${generateReadableError(validationResult.error)}`);
  }

  return validationResult.data;
}

function statusCodeForError(code: SessionLoginErrorCode): number {
  switch (code) {
    case "TOKEN_EXCHANGE_FAILED":
    case "USER_INFO_FAILED":
      return 502;
    case "ID_TOKEN_VERIFICATION_FAILED":
    case "ACCESS_TOKEN_VERIFICATION_FAILED":
    case "ID_TOKEN_SUB_MISSING":
    case "SUBJECT_MISMATCH":
    case "ID_TOKEN_ISS_MISSING":
    case "ID_TOKEN_AUD_INVALID":
      return 401;
    case "SESSION_DATA_INVALID":
    case "SESSION_PERSIST_FAILED":
    default:
      return 500;
  }
}

export const lambdaHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const correlationId = resolveCorrelationId(event);
  let body: SessionLoginBody;

  try {
    body = parseBody(event.body);
  } catch (error) {
    return createJsonResponse(
      400,
      {
        message: error instanceof Error ? error.message : "Invalid request body",
      },
      { "X-Correlation-ID": correlationId },
    );
  }

  const { sessionLoginService, authCookieSameSite, authCookieSecure } = await init();
  const result = await sessionLoginService.executeCallback(body.code);

  if (!result.success) {
    const statusCode = statusCodeForError(result.error.code);
    console.info(name, "Preview session login failed", {
      correlationId,
      code: result.error.code,
      statusCode,
    });

    return createJsonResponse(
      statusCode,
      { message: result.error.message },
      { "X-Correlation-ID": correlationId },
    );
  }

  const response = createJsonResponse(
    200,
    {
      userInfo: result.result.userInfo,
      sessionId: result.result.sessionId,
      refreshTokenId: result.result.refreshTokenId,
      sessionCreatedAt: result.result.sessionCreatedAt,
    },
    {
      "X-Correlation-ID": correlationId,
    },
  );

  return {
    ...response,
    multiValueHeaders: {
      "Set-Cookie": [
        buildPreviewAccessCookie(
          result.result.signedAccessToken,
          authCookieSameSite,
          authCookieSecure,
        ),
        buildPreviewRefreshCookie(
          result.result.signedRefreshToken,
          authCookieSameSite,
          authCookieSecure,
        ),
      ],
    },
  };
};

export const handler = middy(lambdaHandler)
  .use(httpSecurityHeaders(securityHeaders))
  .use(cors(defaultCorsOptions))
  .use(httpErrorHandler());
