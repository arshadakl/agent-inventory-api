import { env } from "cloudflare:workers";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import app from "../worker/index";
import { verifyPassword } from "../worker/lib/password";
import { hashSessionToken } from "../worker/lib/session";

const APP_ORIGIN = "https://inventory.example.com";
const CURRENT_USER_ID = "00000000-0000-4000-8000-000000000301";
const SESSION_TOKEN = "users-api-test-session";
let sessionTokenHash: string;

beforeAll(async () => {
  sessionTokenHash = await hashSessionToken(SESSION_TOKEN);
});

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM sessions").run();
  await env.DB.prepare("DELETE FROM users").run();
  await insertUser(CURRENT_USER_ID, "owner@example.com");
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(
      "00000000-0000-4000-8000-000000000302",
      CURRENT_USER_ID,
      sessionTokenHash,
      2_000_000_000,
    )
    .run();
});

describe("users API", () => {
  it("lists safe user records without password hashes", async () => {
    await insertUser(
      "00000000-0000-4000-8000-000000000303",
      "agent@example.com",
    );

    const response = await authenticatedRequest("/api/users");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      data: {
        users: [
          {
            id: expect.any(String),
            email: expect.any(String),
            createdAt: expect.any(Number),
            updatedAt: expect.any(Number),
          },
          {
            id: expect.any(String),
            email: expect.any(String),
            createdAt: expect.any(Number),
            updatedAt: expect.any(Number),
          },
        ],
      },
    });
    expect(JSON.stringify(body)).not.toContain("password");
  });

  it("creates a normalized user with a verifiable password hash", async () => {
    const password = "another secure password";
    const response = await authenticatedRequest("/api/users", {
      method: "POST",
      body: JSON.stringify({
        email: "  Agent@Example.COM ",
        password,
      }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      data: {
        user: {
          id: expect.any(String),
          email: "agent@example.com",
          createdAt: expect.any(Number),
          updatedAt: expect.any(Number),
        },
      },
    });
    expect(JSON.stringify(body)).not.toContain("password");

    const row = await env.DB.prepare(
      "SELECT password_hash FROM users WHERE email = ?",
    )
      .bind("agent@example.com")
      .first<{ password_hash: string }>();
    expect(await verifyPassword(password, row?.password_hash ?? "")).toBe(true);
  });

  it("returns a conflict for a duplicate normalized email", async () => {
    const response = await authenticatedRequest("/api/users", {
      method: "POST",
      body: JSON.stringify({
        email: " OWNER@EXAMPLE.COM ",
        password: "another secure password",
      }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "EMAIL_ALREADY_EXISTS",
        message: "A user with this email already exists.",
        fields: { email: "A user with this email already exists." },
      },
    });
  });

  it("rejects self-deletion without deleting the active session", async () => {
    const response = await authenticatedRequest(
      `/api/users/${CURRENT_USER_ID}`,
      { method: "DELETE" },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "CANNOT_DELETE_SELF" },
    });
    expect(await countRows("users", "id", CURRENT_USER_ID)).toBe(1);
    expect(await countRows("sessions", "user_id", CURRENT_USER_ID)).toBe(1);
  });

  it("deletes another user and cascades their sessions", async () => {
    const otherUserId = "00000000-0000-4000-8000-000000000304";
    await insertUser(otherUserId, "agent@example.com");
    await env.DB.prepare(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind(
        "00000000-0000-4000-8000-000000000305",
        otherUserId,
        "other-session-hash",
        2_000_000_000,
      )
      .run();

    const response = await authenticatedRequest(`/api/users/${otherUserId}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(204);
    expect(await countRows("users", "id", otherUserId)).toBe(0);
    expect(await countRows("sessions", "user_id", otherUserId)).toBe(0);
  });

  it("validates new users and returns 404 for a missing deletion target", async () => {
    const invalidResponse = await authenticatedRequest("/api/users", {
      method: "POST",
      body: JSON.stringify({ email: "invalid", password: "short" }),
    });
    const missingResponse = await authenticatedRequest(
      "/api/users/00000000-0000-4000-8000-000000000399",
      { method: "DELETE" },
    );

    expect(invalidResponse.status).toBe(400);
    await expect(invalidResponse.json()).resolves.toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        fields: { email: expect.any(String), password: expect.any(String) },
      },
    });
    expect(missingResponse.status).toBe(404);
  });
});

async function insertUser(id: string, email: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
  )
    .bind(id, email, "test-password-hash")
    .run();
}

async function countRows(
  table: "users" | "sessions",
  column: "id" | "user_id",
  value: string,
): Promise<number> {
  const result = await env.DB.prepare(
    `SELECT COUNT(*) AS total FROM ${table} WHERE ${column} = ?`,
  )
    .bind(value)
    .first<{ total: number }>();
  return result?.total ?? 0;
}

async function authenticatedRequest(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Cookie", `session=${SESSION_TOKEN}`);

  if (init.method && init.method !== "GET") {
    headers.set("Origin", APP_ORIGIN);
  }

  if (init.body) {
    headers.set("Content-Type", "application/json");
  }

  return app.request(`${APP_ORIGIN}${path}`, { ...init, headers }, env);
}
