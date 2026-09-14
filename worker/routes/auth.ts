import { loginSchema } from "@shared/schemas/auth";
import type { ApiData } from "@shared/types/api";
import type { AuthenticatedUser } from "@shared/types/user";
import { Hono } from "hono";

import type { WorkerEnvironment } from "../env";
import { getCurrentUser } from "../middleware/auth";
import { clearSessionCookie, setSessionCookie } from "../lib/cookies";
import { readJsonBody } from "../lib/request";
import { errorResponse, getZodFieldErrors } from "../lib/response";
import {
  authenticateCredentials,
  createSession,
  deleteSessionByToken,
} from "../services/auth.service";

export const authRoutes = new Hono<WorkerEnvironment>();

authRoutes.post("/login", async (context) => {
  const body = await readJsonBody(context.req.raw);

  if (!body.ok) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "The login request must contain valid JSON.",
    );
  }

  const parsedInput = loginSchema.safeParse(body.value);

  if (!parsedInput.success) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "Invalid login request.",
      getZodFieldErrors(parsedInput.error),
    );
  }

  const user = await authenticateCredentials(context.env.DB, parsedInput.data);

  if (!user) {
    return errorResponse(
      context,
      401,
      "UNAUTHORIZED",
      "Invalid email or password",
    );
  }

  const session = await createSession(context.env.DB, user.id);
  setSessionCookie(context, session.token, session.expiresAt);

  return context.json<ApiData<{ user: AuthenticatedUser }>>({ data: { user } });
});

authRoutes.get("/me", (context) => {
  const user = getCurrentUser(context);

  return context.json<ApiData<{ user: AuthenticatedUser }>>({ data: { user } });
});

authRoutes.post("/logout", async (context) => {
  await deleteSessionByToken(context.env.DB, context.get("sessionToken"));
  clearSessionCookie(context);

  return context.body(null, 204);
});
