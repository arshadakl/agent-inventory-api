import { createMiddleware } from "hono/factory";

import type { WorkerEnvironment } from "../env";
import { errorResponse } from "../lib/response";
import { authenticateApiKey } from "../services/api-keys.service";

export const requireApiKey = createMiddleware<WorkerEnvironment>(
  async (context, next) => {
    const apiKeyId = await authenticateApiKey(
      context.env.DB,
      context.req.header("Authorization"),
    );

    if (!apiKeyId) {
      return errorResponse(
        context,
        401,
        "UNAUTHORIZED",
        "Authentication is required.",
      );
    }

    context.set("apiKeyId", apiKeyId);
    await next();
  },
);
