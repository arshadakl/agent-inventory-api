import type { AuthenticatedUser } from "@shared/types/user";
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

import type { WorkerEnvironment } from "../env";
import { clearSessionCookie } from "../lib/cookies";
import { errorResponse } from "../lib/response";
import { SESSION_COOKIE_NAME } from "../lib/session";
import { findUserBySessionToken } from "../services/auth.service";

const LOGIN_PATH = "/api/auth/login";
const INTEGRATION_PATH_PREFIX = "/api/v1/";

export const requireAuthentication = createMiddleware<WorkerEnvironment>(
  async (context, next) => {
    if (context.req.path.startsWith(INTEGRATION_PATH_PREFIX)) {
      await next();
      return;
    }

    if (context.req.method === "POST" && context.req.path === LOGIN_PATH) {
      await next();
      return;
    }

    const sessionToken = getCookie(context, SESSION_COOKIE_NAME);

    if (!sessionToken) {
      return unauthorizedResponse(context);
    }

    const user = await findUserBySessionToken(context.env.DB, sessionToken);

    if (!user) {
      clearSessionCookie(context);
      return unauthorizedResponse(context);
    }

    context.set("currentUser", user);
    context.set("sessionToken", sessionToken);
    await next();
  },
);

function unauthorizedResponse(
  context: Parameters<typeof errorResponse>[0],
): Response {
  return errorResponse(
    context,
    401,
    "UNAUTHORIZED",
    "Authentication is required.",
  );
}

export function getCurrentUser(context: {
  get(key: "currentUser"): AuthenticatedUser;
}): AuthenticatedUser {
  return context.get("currentUser");
}
