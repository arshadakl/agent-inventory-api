import { env } from "cloudflare:workers";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import app from "../worker/index";
import { hashPassword } from "../worker/lib/password";
import { hashSessionToken } from "../worker/lib/session";

const APP_ORIGIN = "https://inventory.example.com";
const EMAIL = "owner@example.com";
const PASSWORD = "correct horse battery staple";
const USER_ID = "00000000-0000-4000-8000-000000000101";

let passwordHash: string;

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD);
});

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM sessions").run();
  await env.DB.prepare("DELETE FROM users").run();
  await env.DB.prepare(
    "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
  )
    .bind(USER_ID, EMAIL, passwordHash)
    .run();
});

describe("authentication API", () => {
  it("logs in with normalized credentials and stores only a token hash", async () => {
    const response = await login("  OWNER@EXAMPLE.COM  ", PASSWORD);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        user: {
          id: USER_ID,
          email: EMAIL,
        },
      },
    });

    const setCookie = getRequiredHeader(response, "set-cookie");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Secure");

    const rawToken = extractSessionCookie(setCookie).slice("session=".length);
    const session = await env.DB.prepare(
      "SELECT token_hash FROM sessions WHERE user_id = ?",
    )
      .bind(USER_ID)
      .first<{ token_hash: string }>();

    expect(session).not.toBeNull();

    if (!session) {
      throw new Error("Expected the login request to create a session.");
    }

    expect(session.token_hash).not.toBe(rawToken);
  });

  it("returns the same generic failure for a wrong password and unknown email", async () => {
    const wrongPasswordResponse = await login(EMAIL, "incorrect password");
    const unknownEmailResponse = await login("unknown@example.com", PASSWORD);

    expect(wrongPasswordResponse.status).toBe(401);
    expect(unknownEmailResponse.status).toBe(401);
    await expect(wrongPasswordResponse.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid email or password",
      },
    });
    await expect(unknownEmailResponse.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid email or password",
      },
    });
  });

  it("rejects protected endpoints without a valid session", async () => {
    const response = await app.request(
      `${APP_ORIGIN}/api/auth/me`,
      undefined,
      env,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication is required.",
      },
    });
  });

  it("allows a valid session to access the current user and protected health endpoints", async () => {
    const loginResponse = await login(EMAIL, PASSWORD);
    const cookie = extractSessionCookie(
      getRequiredHeader(loginResponse, "set-cookie"),
    );

    const meResponse = await authenticatedGet("/api/auth/me", cookie);
    const healthResponse = await authenticatedGet("/api/health", cookie);

    expect(meResponse.status).toBe(200);
    await expect(meResponse.json()).resolves.toEqual({
      data: {
        user: {
          id: USER_ID,
          email: EMAIL,
        },
      },
    });
    expect(healthResponse.status).toBe(200);
  });

  it("treats expired sessions as unauthenticated", async () => {
    const rawToken = "expired-session-token";
    const tokenHash = await hashSessionToken(rawToken);
    await env.DB.prepare(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind("00000000-0000-4000-8000-000000000102", USER_ID, tokenHash, 1)
      .run();

    const response = await authenticatedGet(
      "/api/auth/me",
      `session=${rawToken}`,
    );

    expect(response.status).toBe(401);
    expect(getRequiredHeader(response, "set-cookie")).toContain("Max-Age=0");
  });

  it("invalidates the current session on logout", async () => {
    const loginResponse = await login(EMAIL, PASSWORD);
    const cookie = extractSessionCookie(
      getRequiredHeader(loginResponse, "set-cookie"),
    );
    const logoutResponse = await app.request(
      `${APP_ORIGIN}/api/auth/logout`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: APP_ORIGIN,
        },
      },
      env,
    );

    expect(logoutResponse.status).toBe(204);
    expect(getRequiredHeader(logoutResponse, "set-cookie")).toContain(
      "Max-Age=0",
    );

    const meResponse = await authenticatedGet("/api/auth/me", cookie);
    expect(meResponse.status).toBe(401);

    const sessionCount = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?",
    )
      .bind(USER_ID)
      .first<{ count: number }>();
    expect(sessionCount?.count).toBe(0);
  });

  it("rejects state-changing requests from an untrusted origin", async () => {
    const response = await app.request(
      `${APP_ORIGIN}/api/auth/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://attacker.example.com",
        },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      },
      env,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INVALID_ORIGIN",
        message: "The request origin is not allowed.",
      },
    });
  });

  it("returns field errors for invalid login input", async () => {
    const response = await login("not-an-email", "");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid login request.",
        fields: {
          email: "Enter a valid email address.",
          password: "Password is required.",
        },
      },
    });
  });
});

async function login(email: string, password: string): Promise<Response> {
  return await app.request(
    `${APP_ORIGIN}/api/auth/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: APP_ORIGIN,
      },
      body: JSON.stringify({ email, password }),
    },
    env,
  );
}

async function authenticatedGet(
  path: string,
  cookie: string,
): Promise<Response> {
  return await app.request(
    `${APP_ORIGIN}${path}`,
    {
      headers: { Cookie: cookie },
    },
    env,
  );
}

function getRequiredHeader(response: Response, name: string): string {
  const value = response.headers.get(name);

  if (!value) {
    throw new Error(`Expected response header: ${name}`);
  }

  return value;
}

function extractSessionCookie(setCookie: string): string {
  const cookie = setCookie.split(";", 1)[0];

  if (!cookie?.startsWith("session=")) {
    throw new Error("Expected a session cookie.");
  }

  return cookie;
}
