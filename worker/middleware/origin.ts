import { createMiddleware } from "hono/factory";

import type { WorkerEnvironment } from "../env";
import { errorResponse } from "../lib/response";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

export const requireSameOrigin = createMiddleware<WorkerEnvironment>(
  async (context, next) => {
    if (SAFE_METHODS.has(context.req.method)) {
      await next();
      return;
    }

    const requestUrl = new URL(context.req.url);
    const origin = context.req.header("Origin");

    if (!origin && LOCAL_HOSTS.has(requestUrl.hostname)) {
      await next();
      return;
    }

    if (!origin || !isMatchingOrigin(origin, requestUrl.origin)) {
      return errorResponse(
        context,
        403,
        "INVALID_ORIGIN",
        "The request origin is not allowed.",
      );
    }

    await next();
  },
);

function isMatchingOrigin(origin: string, expectedOrigin: string): boolean {
  try {
    return new URL(origin).origin === expectedOrigin;
  } catch {
    return false;
  }
}
