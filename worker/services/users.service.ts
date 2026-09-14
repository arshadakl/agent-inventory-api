import type { CreateUserInput } from "@shared/schemas/auth";
import type { User } from "@shared/types/user";

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

function isEmailUniquenessError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("UNIQUE constraint failed: users.email")
  );
}
