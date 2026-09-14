import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";

import type { WorkerEnvironment } from "../env";
import { SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from "./session";

const COOKIE_PATH = "/";

export function setSessionCookie(
  context: Context<WorkerEnvironment>,
  token: string,
  expiresAt: number,
): void {
  setCookie(context, SESSION_COOKIE_NAME, token, {
    expires: new Date(expiresAt * 1_000),
    httpOnly: true,
    maxAge: SESSION_DURATION_SECONDS,
    path: COOKIE_PATH,
    sameSite: "Lax",
    secure: isSecureRequest(context),
  });
}

export function clearSessionCookie(context: Context<WorkerEnvironment>): void {
  deleteCookie(context, SESSION_COOKIE_NAME, {
    path: COOKIE_PATH,
    sameSite: "Lax",
    secure: isSecureRequest(context),
  });
}

function isSecureRequest(context: Context<WorkerEnvironment>): boolean {
  return new URL(context.req.url).protocol === "https:";
}
