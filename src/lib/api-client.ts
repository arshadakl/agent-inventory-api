import { z, type ZodType } from "zod";

import type { ApiErrorCode } from "@shared/types/api";

import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.enum([
      "UNAUTHORIZED",
      "INVALID_ORIGIN",
      "VALIDATION_ERROR",
      "NOT_FOUND",
      "EMAIL_ALREADY_EXISTS",
      "API_KEY_NAME_CONFLICT",
      "CANNOT_DELETE_SELF",
      "INTERNAL_ERROR",
      "INBOX_EVENT_DUPLICATE",
      "INBOX_SEND_FAILED",
      "INBOX_MEDIA_TOO_LARGE",
      "INBOX_INVALID_PHONE",
      "INBOX_MESSAGE_NOT_FOUND",
      "INBOX_CONVERSATION_NOT_FOUND",
      "INBOX_ATTACHMENT_NOT_FOUND",
      "INBOX_SCOPE_REQUIRED",
      "INBOX_INVALID_EVENT",
      "INBOX_PROVIDER_ERROR",
    ]),
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
  }),
});

export type ClientErrorCode =
  ApiErrorCode | "NETWORK_ERROR" | "INVALID_RESPONSE";

export class ApiClientError extends Error {
  readonly code: ClientErrorCode;
  readonly fields: Record<string, string> | undefined;
  readonly status: number;

  constructor(
    status: number,
    code: ClientErrorCode,
    message: string,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export async function apiRequest<T>(
  path: `/api/${string}`,
  dataSchema: ZodType<T>,
  options: ApiRequestOptions = {},
): Promise<T> {
  const response = await sendRequest(path, options);
  const body = await readResponseBody(response);

  if (!response.ok) {
    throw createResponseError(response.status, body);
  }

  const parsedBody = z.object({ data: dataSchema }).safeParse(body);

  if (!parsedBody.success) {
    throw new ApiClientError(
      response.status,
      "INVALID_RESPONSE",
      "The server returned an invalid response.",
    );
  }

  return parsedBody.data.data;
}

export async function apiRequestVoid(
  path: `/api/${string}`,
  options: ApiRequestOptions = {},
): Promise<void> {
  const response = await sendRequest(path, options);

  if (response.ok) {
    return;
  }

  throw createResponseError(response.status, await readResponseBody(response));
}

async function sendRequest(
  path: `/api/${string}`,
  options: ApiRequestOptions,
): Promise<Response> {
  const { body, headers, ...requestOptions } = options;
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", "application/json");

  if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(path, {
      ...requestOptions,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      credentials: "same-origin",
      headers: requestHeaders,
    });

    if (response.status === 401) {
      queryClient.setQueryData(queryKeys.currentUser, null);
    }

    return response;
  } catch {
    throw new ApiClientError(
      0,
      "NETWORK_ERROR",
      "Unable to reach the server. Check your connection and try again.",
    );
  }
}

async function readResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function createResponseError(status: number, body: unknown): ApiClientError {
  const parsedBody = apiErrorBodySchema.safeParse(body);

  if (parsedBody.success) {
    return new ApiClientError(
      status,
      parsedBody.data.error.code,
      parsedBody.data.error.message,
      parsedBody.data.error.fields,
    );
  }

  return new ApiClientError(
    status,
    "INVALID_RESPONSE",
    "The request could not be completed.",
  );
}
