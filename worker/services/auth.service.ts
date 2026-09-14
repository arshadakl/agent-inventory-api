import type { LoginInput } from "@shared/schemas/auth";
import type { AuthenticatedUser } from "@shared/types/user";

import { verifyPassword } from "../lib/password";
import {
  createSessionToken,
  hashSessionToken,
  SESSION_DURATION_SECONDS,
} from "../lib/session";

const DUMMY_PASSWORD_HASH =
  "pbkdf2_sha256$600000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

interface UserCredentialRecord {
  id: string;
  email: string;
  password_hash: string;
}

interface SessionUserRecord {
  id: string;
  email: string;
}

export interface CreatedSession {
  expiresAt: number;
  token: string;
}

export async function authenticateCredentials(
  database: D1Database,
  input: LoginInput,
): Promise<AuthenticatedUser | null> {
  const record = await database
    .prepare("SELECT id, email, password_hash FROM users WHERE email = ?")
    .bind(input.email)
    .first<UserCredentialRecord>();
  const passwordMatches = await verifyPassword(
    input.password,
    record?.password_hash ?? DUMMY_PASSWORD_HASH,
  );

  if (!record || !passwordMatches) {
    return null;
  }

  return {
    id: record.id,
    email: record.email,
  };
}

export async function createSession(
  database: D1Database,
  userId: string,
  now = currentUnixTime(),
): Promise<CreatedSession> {
  const token = createSessionToken();
  const tokenHash = await hashSessionToken(token);
  const expiresAt = now + SESSION_DURATION_SECONDS;

  await database.batch([
    database.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
    database
      .prepare(
        `INSERT INTO sessions (id, user_id, token_hash, expires_at)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), userId, tokenHash, expiresAt),
  ]);

  return { expiresAt, token };
}

export async function findUserBySessionToken(
  database: D1Database,
  token: string,
  now = currentUnixTime(),
): Promise<AuthenticatedUser | null> {
  const tokenHash = await hashSessionToken(token);
  const record = await database
    .prepare(
      `SELECT users.id, users.email
       FROM sessions
       INNER JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
    )
    .bind(tokenHash, now)
    .first<SessionUserRecord>();

  return record ? { id: record.id, email: record.email } : null;
}

export async function deleteSessionByToken(
  database: D1Database,
  token: string,
): Promise<void> {
  const tokenHash = await hashSessionToken(token);
  await database
    .prepare("DELETE FROM sessions WHERE token_hash = ?")
    .bind(tokenHash)
    .run();
}

function currentUnixTime(): number {
  return Math.floor(Date.now() / 1_000);
}
