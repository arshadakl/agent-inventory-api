import { env } from "cloudflare:workers";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import app from "../worker/index";
import { hashSessionToken } from "../worker/lib/session";

const APP_ORIGIN = "https://inventory.example.com";
const USER_ID = "00000000-0000-4000-8000-000000000401";
const SESSION_TOKEN = "dashboard-api-test-session";
let sessionTokenHash: string;

beforeAll(async () => {
  sessionTokenHash = await hashSessionToken(SESSION_TOKEN);
});

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM properties").run();
  await env.DB.prepare("DELETE FROM sessions").run();
  await env.DB.prepare("DELETE FROM users").run();
  await env.DB.prepare(
    "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
  )
    .bind(USER_ID, "owner@example.com", "test-password-hash")
    .run();
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(
      "00000000-0000-4000-8000-000000000402",
      USER_ID,
      sessionTokenHash,
      2_000_000_000,
    )
    .run();
});

describe("dashboard API", () => {
  it("requires an authenticated session", async () => {
    const response = await app.request(
      `${APP_ORIGIN}/api/dashboard/stats`,
      undefined,
      env,
    );

    expect(response.status).toBe(401);
  });

  it("returns all inventory totals from one aggregate data set", async () => {
    await insertProperty(
      "00000000-0000-4000-8000-000000000411",
      "sale",
      "available",
    );
    await insertProperty(
      "00000000-0000-4000-8000-000000000412",
      "rent",
      "available",
    );
    await insertProperty(
      "00000000-0000-4000-8000-000000000413",
      "sale",
      "sold",
    );
    await insertProperty(
      "00000000-0000-4000-8000-000000000414",
      "rent",
      "rented",
    );

    const response = await authenticatedStatsRequest();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        total: 4,
        available: 2,
        forSale: 2,
        forRent: 2,
        sold: 1,
        rented: 1,
      },
    });
  });

  it("returns zeros when no properties exist", async () => {
    const response = await authenticatedStatsRequest();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        total: 0,
        available: 0,
        forSale: 0,
        forRent: 0,
        sold: 0,
        rented: 0,
      },
    });
  });
});

async function insertProperty(
  id: string,
  listingType: "sale" | "rent",
  status: "available" | "sold" | "rented",
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO properties (
      id, title, property_type, listing_type, furnished, location, price, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      `Property ${id.slice(-3)}`,
      "apartment",
      listingType,
      0,
      "Dubai",
      500_000,
      status,
    )
    .run();
}

async function authenticatedStatsRequest(): Promise<Response> {
  return app.request(
    `${APP_ORIGIN}/api/dashboard/stats`,
    { headers: { Cookie: `session=${SESSION_TOKEN}` } },
    env,
  );
}
