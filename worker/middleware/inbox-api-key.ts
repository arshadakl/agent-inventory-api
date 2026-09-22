import type { InboxScope } from "@shared/schemas/inbox";
import { createMiddleware } from "hono/factory";

import type { WorkerEnvironment } from "../env";
import { errorResponse } from "../lib/response";
import { authenticateApiKeyWithScopes } from "../services/api-keys.service";

type RequiredScope = InboxScope;

export function requireInboxApiKey(...requiredScopes: RequiredScope[]) {
  return createMiddleware<WorkerEnvironment>(async (context, next) => {
    const result = await authenticateApiKeyWithScopes(
      context.env.DB,
      context.req.header("Authorization"),
    );

    if (!result) {
      return errorResponse(
        context,
        401,
        "UNAUTHORIZED",
        "Authentication is required.",
      );
    }

    if (requiredScopes.length > 0 && result.scopes !== null) {
      const hasAll = requiredScopes.every((scope) =>
        result.scopes!.includes(scope),
      );

      if (!hasAll) {
        return errorResponse(
          context,
          403,
          "INBOX_SCOPE_REQUIRED",
          "This API key does not have the required inbox scopes.",
        );
      }
    }

    context.set("apiKeyId", result.apiKeyId);
    context.set("apiKeyScopes", result.scopes);
    await next();
  });
}
