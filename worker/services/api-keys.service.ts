import type { CreateApiKeyInput } from "@shared/schemas/api-key";
import { apiKeySchema } from "@shared/schemas/api-key";
import type { ApiKey, CreatedApiKey } from "@shared/types/api-key";
import { z } from "zod";

import { createSessionToken, hashSessionToken } from "../lib/session";

const API_KEY_PREFIX = "rei_live_";
const EXPOSED_PREFIX_LENGTH = 8;

const apiKeyRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  key_prefix: z.string(),
  created_at: z.number().int().nonnegative(),
  last_used_at: z.number().int().nonnegative().nullable(),
  revoked_at: z.number().int().nonnegative().nullable(),
});

export class ApiKeyNameConflictError extends Error {
  constructor() {
    super("An API key with this name already exists.");
    this.name = "ApiKeyNameConflictError";
  }
}

export async function createApiKey(
  database: D1Database,
  input: CreateApiKeyInput,
  creatorId: string,
): Promise<CreatedApiKey> {
  const existingKey = await database
    .prepare("SELECT id FROM api_keys WHERE name = ?")
    .bind(input.name)
    .first<{ id: string }>();

  if (existingKey) {
    throw new ApiKeyNameConflictError();
  }

  const secret = `${API_KEY_PREFIX}${createSessionToken()}`;
  const prefix = secret.slice(0, API_KEY_PREFIX.length + EXPOSED_PREFIX_LENGTH);
  const tokenHash = await hashSessionToken(secret);
  const id = crypto.randomUUID();
  const now = currentUnixTime();

  try {
    await database
      .prepare(
        `INSERT INTO api_keys (
          id, name, key_prefix, token_hash, created_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, input.name, prefix, tokenHash, creatorId, now)
      .run();
  } catch (error) {
    if (isApiKeyNameConflict(error)) {
      throw new ApiKeyNameConflictError();
    }

    throw error;
  }

  return {
    apiKey: {
      id,
      name: input.name,
      prefix,
      createdAt: now,
      lastUsedAt: null,
      revokedAt: null,
    },
    secret,
  };
}

export async function listApiKeys(database: D1Database): Promise<ApiKey[]> {
  const result = await database
    .prepare(
      `SELECT id, name, key_prefix, created_at, last_used_at, revoked_at
       FROM api_keys
       ORDER BY created_at DESC, id DESC`,
    )
    .all();

  return result.results.map(mapApiKeyRow);
}

export async function deleteApiKey(
  database: D1Database,
  id: string,
): Promise<boolean> {
  const result = await database
    .prepare("DELETE FROM api_keys WHERE id = ?")
    .bind(id)
    .run();

  return result.meta.changes > 0;
}

export async function authenticateApiKey(
  database: D1Database,
  authorization: string | undefined,
): Promise<string | null> {
  const token = readBearerToken(authorization);

  if (!token || !token.startsWith(API_KEY_PREFIX)) {
    return null;
  }

  const tokenHash = await hashSessionToken(token);
  const record = await database
    .prepare(
      `SELECT id FROM api_keys
       WHERE token_hash = ? AND revoked_at IS NULL`,
    )
    .bind(tokenHash)
    .first<{ id: string }>();

  if (!record) {
    return null;
  }

  await database
    .prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?")
    .bind(currentUnixTime(), record.id)
    .run();

  return record.id;
}

function mapApiKeyRow(row: Record<string, unknown>): ApiKey {
  const key = apiKeyRowSchema.parse(row);

  return apiKeySchema.parse({
    id: key.id,
    name: key.name,
    prefix: key.key_prefix,
    createdAt: key.created_at,
    lastUsedAt: key.last_used_at,
    revokedAt: key.revoked_at,
  });
}

function readBearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

function isApiKeyNameConflict(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("UNIQUE constraint failed: api_keys.name")
  );
}

function currentUnixTime(): number {
  return Math.floor(Date.now() / 1_000);
}
