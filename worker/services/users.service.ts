import type { CreateUserInput } from "@shared/schemas/auth";
import type { User } from "@shared/types/user";
import { userSchema } from "@shared/schemas/user";

import { hashPassword } from "../lib/password";

export class EmailAlreadyExistsError extends Error {
  constructor() {
    super("A user with this email already exists.");
    this.name = "EmailAlreadyExistsError";
  }
}

export async function createUser(
  database: D1Database,
  input: CreateUserInput,
): Promise<User> {
  const existingUser = await database
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(input.email)
    .first<{ id: string }>();

  if (existingUser) {
    throw new EmailAlreadyExistsError();
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(input.password);
  const now = Math.floor(Date.now() / 1_000);

  try {
    await database
      .prepare(
        `INSERT INTO users (id, email, password_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(id, input.email, passwordHash, now, now)
      .run();
  } catch (error) {
    if (isEmailUniquenessError(error)) {
      throw new EmailAlreadyExistsError();
    }

    throw error;
  }

  return {
    id,
    email: input.email,
    createdAt: now,
    updatedAt: now,
  };
}

export async function listUsers(database: D1Database): Promise<User[]> {
  const result = await database
    .prepare(
      `SELECT id, email, created_at, updated_at
       FROM users
       ORDER BY created_at ASC, email ASC`,
    )
    .all();

  return result.results.map(mapUserRow);
}

export async function deleteUser(
  database: D1Database,
  id: string,
): Promise<boolean> {
  const result = await database
    .prepare("DELETE FROM users WHERE id = ?")
    .bind(id)
    .run();

  return result.meta.changes > 0;
}

function isEmailUniquenessError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("UNIQUE constraint failed: users.email")
  );
}

function mapUserRow(row: Record<string, unknown>): User {
  const parsedRow = userRowSchema.parse(row);

  return userSchema.parse({
    id: parsedRow.id,
    email: parsedRow.email,
    createdAt: parsedRow.created_at,
    updatedAt: parsedRow.updated_at,
  });
}

const userRowSchema = userSchema.pick({ id: true, email: true }).extend({
  created_at: userSchema.shape.createdAt,
  updated_at: userSchema.shape.updatedAt,
});
