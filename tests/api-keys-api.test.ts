import { env } from "cloudflare:workers";
import { apiKeySchema } from "@shared/schemas/api-key";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import app from "../worker/index";
import { hashSessionToken } from "../worker/lib/session";

const APP_ORIGIN = "https://inventory.example.com";
const CURRENT_USER_ID = "00000000-0000-4000-8000-000000000601";
const SESSION_TOKEN = "api-keys-test-session";
let sessionTokenHash: string;

const createdApiKeyResponseSchema = z.object({
  data: z.object({ apiKey: apiKeySchema, secret: z.string() }),
});

beforeAll(async () => {
  sessionTokenHash = await hashSessionToken(SESSION_TOKEN);
});

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM api_keys").run();
  await env.DB.prepare("DELETE FROM sessions").run();
  await env.DB.prepare("DELETE FROM users").run();
  await env.DB.prepare(
    "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
  )
    .bind(CURRENT_USER_ID, "owner@example.com", "password-hash")
    .run();
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(
      "00000000-0000-4000-8000-000000000602",
      CURRENT_USER_ID,
      sessionTokenHash,
      2_000_000_000,
    )
    .run();
});

describe("API key API", () => {
  it("creates a key once without exposing its stored hash", async () => {
    const response = await authenticatedRequest("/api/api-keys", {
      method: "POST",
      body: JSON.stringify({ name: "n8n production" }),
    });
    const body = createdApiKeyResponseSchema.parse(await response.json());

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      data: {
        apiKey: {
          id: expect.any(String),
          name: "n8n production",
          prefix: expect.stringMatching(/^rei_live_/u),
          lastUsedAt: null,
          revokedAt: null,
        },
        secret: expect.stringMatching(/^rei_live_/u),
      },
    });
    expect(JSON.stringify(body)).not.toContain("token_hash");

    const storedKey = await env.DB.prepare(
      "SELECT token_hash FROM api_keys WHERE name = ?",
    )
      .bind("n8n production")
      .first<{ token_hash: string }>();
    expect(storedKey?.token_hash).not.toBe(body.data.secret);

    const listedResponse = await authenticatedRequest("/api/api-keys");
    const listedBody = await listedResponse.json();
    expect(JSON.stringify(listedBody)).not.toContain(body.data.secret);
  });

  it("rejects duplicate names and invalid session access", async () => {
    await createApiKey("n8n");

    const duplicateResponse = await authenticatedRequest("/api/api-keys", {
      method: "POST",
      body: JSON.stringify({ name: "N8N" }),
    });
    const unauthenticatedResponse = await request("/api/api-keys");

    expect(duplicateResponse.status).toBe(409);
    await expect(duplicateResponse.json()).resolves.toMatchObject({
      error: { code: "API_KEY_NAME_CONFLICT" },
    });
    expect(unauthenticatedResponse.status).toBe(401);
  });

  it("accepts a bearer key without an Origin header and rejects it after deletion", async () => {
    const createdKey = await createApiKey("n8n action");
    const authorizedResponse = await request("/api/v1/actions/execute", {
      headers: { Authorization: `Bearer ${createdKey.secret}` },
      method: "POST",
    });

    expect(authorizedResponse.status).toBe(400);
    const storedKey = await env.DB.prepare(
      "SELECT last_used_at FROM api_keys WHERE id = ?",
    )
      .bind(createdKey.apiKey.id)
      .first<{ last_used_at: number | null }>();
    expect(storedKey?.last_used_at).toEqual(expect.any(Number));

    const deleteResponse = await authenticatedRequest(
      `/api/api-keys/${createdKey.apiKey.id}`,
      { method: "DELETE" },
    );
    const deletedResponse = await request("/api/v1/actions/execute", {
      headers: { Authorization: `Bearer ${createdKey.secret}` },
      method: "POST",
    });
    const cookieOnlyResponse = await request("/api/v1/actions/execute", {
      headers: { Cookie: `session=${SESSION_TOKEN}` },
      method: "POST",
    });

    expect(deleteResponse.status).toBe(204);
    expect(deletedResponse.status).toBe(401);
    expect(cookieOnlyResponse.status).toBe(401);
  });
});

async function createApiKey(name: string): Promise<{
  apiKey: { id: string };
  secret: string;
}> {
  const response = await authenticatedRequest("/api/api-keys", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  expect(response.status).toBe(201);
  return createdApiKeyResponseSchema.parse(await response.json()).data;
}

function authenticatedRequest(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return request(path, {
    ...init,
    headers: {
      Cookie: `session=${SESSION_TOKEN}`,
      Origin: APP_ORIGIN,
      ...init.headers,
    },
  });
}

function request(path: string, init: RequestInit = {}): Promise<Response> {
  return Promise.resolve(
    app.request(`https://inventory.example.com${path}`, init, env),
  );
}
