import { z } from "zod";

import { createApiKeySchema } from "@shared/schemas/api-key";
import type { ApiData } from "@shared/types/api";
import type { ApiKey, CreatedApiKey } from "@shared/types/api-key";
import { Hono } from "hono";

import type { WorkerEnvironment } from "../env";
import { readJsonBody } from "../lib/request";
import { errorResponse, getZodFieldErrors } from "../lib/response";
import { getCurrentUser } from "../middleware/auth";
import {
  ApiKeyNameConflictError,
  createApiKey,
  listApiKeys,
  deleteApiKey,
} from "../services/api-keys.service";

const apiKeyIdSchema = z.uuid();

export const apiKeyRoutes = new Hono<WorkerEnvironment>();

apiKeyRoutes.get("/", async (context) => {
  const apiKeys = await listApiKeys(context.env.DB);
  return context.json<ApiData<{ apiKeys: ApiKey[] }>>({ data: { apiKeys } });
});

apiKeyRoutes.post("/", async (context) => {
  const body = await readJsonBody(context.req.raw);

  if (!body.ok) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "The request must contain valid JSON.",
    );
  }

  const parsedInput = createApiKeySchema.safeParse(body.value);

  if (!parsedInput.success) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "Invalid API key details.",
      getZodFieldErrors(parsedInput.error),
    );
  }

  try {
    const createdApiKey = await createApiKey(
      context.env.DB,
      parsedInput.data,
      getCurrentUser(context).id,
    );
    return context.json<ApiData<CreatedApiKey>>({ data: createdApiKey }, 201);
  } catch (error) {
    if (error instanceof ApiKeyNameConflictError) {
      return errorResponse(
        context,
        409,
        "API_KEY_NAME_CONFLICT",
        error.message,
        { name: error.message },
      );
    }

    throw error;
  }
});

apiKeyRoutes.delete("/:id", async (context) => {
  const parsedId = apiKeyIdSchema.safeParse(context.req.param("id"));

  if (!parsedId.success) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "The API key ID is invalid.",
      { id: "Enter a valid API key ID." },
    );
  }

  if (!(await deleteApiKey(context.env.DB, parsedId.data))) {
    return errorResponse(
      context,
      404,
      "NOT_FOUND",
      "The API key was not found.",
    );
  }

  return context.body(null, 204);
});
