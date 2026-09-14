import type { ApiErrorBody, ApiErrorCode } from "@shared/types/api";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ZodError } from "zod";

import type { WorkerEnvironment } from "../env";

export function errorResponse(
  context: Context<WorkerEnvironment>,
  status: ContentfulStatusCode,
  code: ApiErrorCode,
  message: string,
  fields?: Record<string, string>,
): Response {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
      ...(fields && Object.keys(fields).length > 0 ? { fields } : {}),
    },
  };

  return context.json(body, status);
}

export function getZodFieldErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (typeof field === "string" && fields[field] === undefined) {
      fields[field] = issue.message;
    }
  }

  return fields;
}
