import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

const USER_ID = "00000000-0000-4000-8000-000000000001";

describe("D1 initial schema", () => {
  it("creates the required application tables", async () => {
    const result = await env.DB.prepare(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'table' AND name IN ('users', 'sessions', 'properties')
       ORDER BY name`,
    ).all<{ name: string }>();

    expect(result.results.map(({ name }) => name)).toEqual([
      "properties",
      "sessions",
      "users",
    ]);
  });

  it("enforces case-insensitive unique user emails", async () => {
    await insertUser(USER_ID, "owner@example.com");

    await expect(
      insertUser("00000000-0000-4000-8000-000000000002", "Owner@Example.com"),
    ).rejects.toThrow();
  });

  it("cascades user deletion to active sessions", async () => {
    const userId = "00000000-0000-4000-8000-000000000003";
    await insertUser(userId, "agent@example.com");
    await env.DB.prepare(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind(
        "00000000-0000-4000-8000-000000000004",
        userId,
        "session-token-hash",
        2_000_000_000,
      )
      .run();

    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();

    const session = await env.DB.prepare(
      "SELECT id FROM sessions WHERE user_id = ?",
    )
      .bind(userId)
      .first();
    expect(session).toBeNull();
  });

  it("rejects property values outside domain constraints", async () => {
    await expect(
      env.DB.prepare(
        `INSERT INTO properties (
          id, title, property_type, listing_type, furnished, location, price, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          "00000000-0000-4000-8000-000000000005",
          "Invalid property",
          "castle",
          "sale",
          0,
          "Dubai",
          -1,
          "available",
        )
        .run(),
    ).rejects.toThrow();
  });
});

async function insertUser(id: string, email: string): Promise<D1Result> {
  return env.DB.prepare(
    "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
  )
    .bind(id, email, "test-password-hash")
    .run();
}
