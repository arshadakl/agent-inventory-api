import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

import { createUserSchema } from "@shared/schemas/auth";

import { verifyPassword } from "../worker/lib/password";
import {
  createUser,
  EmailAlreadyExistsError,
} from "../worker/services/users.service";

interface StoredUser {
  id: string;
  email: string;
  password_hash: string;
}

describe("initial-user provisioning service", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM users").run();
  });

  it("normalizes the email and stores only a PBKDF2 password hash", async () => {
    const input = createUserSchema.parse({
      email: "  Owner@Example.COM ",
      password: "correct horse battery staple",
    });

    const user = await createUser(env.DB, input);
    const storedUser = await env.DB.prepare(
      "SELECT id, email, password_hash FROM users WHERE id = ?",
    )
      .bind(user.id)
      .first<StoredUser>();

    expect(user).toMatchObject({
      id: expect.any(String),
      email: "owner@example.com",
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
    });
    expect(user).not.toHaveProperty("passwordHash");
    expect(storedUser).toMatchObject({
      id: user.id,
      email: "owner@example.com",
      password_hash: expect.stringMatching(/^pbkdf2_sha256\$/u),
    });
    expect(
      await verifyPassword(input.password, storedUser?.password_hash ?? ""),
    ).toBe(true);
    expect(storedUser?.password_hash).not.toContain(input.password);
  });

  it("rejects a duplicate email without adding another user", async () => {
    const firstInput = createUserSchema.parse({
      email: "owner@example.com",
      password: "first secure password",
    });
    const duplicateInput = createUserSchema.parse({
      email: " Owner@Example.com ",
      password: "second secure password",
    });

    await createUser(env.DB, firstInput);

    await expect(createUser(env.DB, duplicateInput)).rejects.toBeInstanceOf(
      EmailAlreadyExistsError,
    );

    const result = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM users",
    ).first<{ total: number }>();
    expect(result?.total).toBe(1);
  });

  it("requires an eight-character bootstrap password", () => {
    const result = createUserSchema.safeParse({
      email: "owner@example.com",
      password: "short7!",
    });

    expect(result.success).toBe(false);
  });
});
