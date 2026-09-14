import { env } from "cloudflare:workers";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import app from "../worker/index";
import { hashSessionToken } from "../worker/lib/session";

const APP_ORIGIN = "https://inventory.example.com";
const SESSION_TOKEN = "property-api-test-session";
const USER_ID = "00000000-0000-4000-8000-000000000201";

const validProperty = {
  title: "Marina View Apartment",
  propertyType: "apartment",
  listingType: "sale",
  furnished: true,
  location: "Dubai Marina",
  price: 1_250_000,
  areaSqft: 1_100,
  bedrooms: 2,
  bathrooms: 2,
  status: "available",
  description: "Bright apartment with a marina view.",
} as const;

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
      "00000000-0000-4000-8000-000000000202",
      USER_ID,
      sessionTokenHash,
      2_000_000_000,
    )
    .run();
});

describe("properties API", () => {
  it("requires authentication", async () => {
    const response = await app.request(
      `${APP_ORIGIN}/api/properties`,
      undefined,
      env,
    );

    expect(response.status).toBe(401);
  });

  it("creates and returns a camelCase property without leaking D1 fields", async () => {
    const response = await authenticatedRequest("/api/properties", {
      method: "POST",
      body: JSON.stringify(validProperty),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({
      data: {
        property: {
          id: expect.any(String),
          ...validProperty,
          createdAt: expect.any(Number),
          updatedAt: expect.any(Number),
        },
      },
    });
    expect(JSON.stringify(body)).not.toContain("property_type");
  });

  it("returns field errors for invalid property details", async () => {
    const response = await authenticatedRequest("/api/properties", {
      method: "POST",
      body: JSON.stringify({
        ...validProperty,
        title: "x",
        price: -1,
        furnished: "yes",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        fields: {
          furnished: expect.any(String),
          price: "Price cannot be negative.",
          title: "Title must be at least 2 characters.",
        },
      },
    });
  });

  it("fetches, updates, deletes, and then returns 404 for a property", async () => {
    const propertyId = await createProperty();

    const getResponse = await authenticatedRequest(
      `/api/properties/${propertyId}`,
    );
    expect(getResponse.status).toBe(200);

    const updateResponse = await authenticatedRequest(
      `/api/properties/${propertyId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          price: 1_300_000,
          bedrooms: null,
          description: "",
        }),
      },
    );
    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      data: {
        property: {
          id: propertyId,
          price: 1_300_000,
          bedrooms: null,
          description: null,
          title: validProperty.title,
        },
      },
    });

    const deleteResponse = await authenticatedRequest(
      `/api/properties/${propertyId}`,
      { method: "DELETE" },
    );
    expect(deleteResponse.status).toBe(204);

    const missingResponse = await authenticatedRequest(
      `/api/properties/${propertyId}`,
    );
    expect(missingResponse.status).toBe(404);
  });

  it("combines search and filters with deterministic pagination", async () => {
    await insertProperty({
      id: "00000000-0000-4000-8000-000000000211",
      title: "Marina Apartment",
      propertyType: "apartment",
      listingType: "sale",
      status: "available",
      createdAt: 100,
    });
    await insertProperty({
      id: "00000000-0000-4000-8000-000000000212",
      title: "Marina Villa",
      propertyType: "villa",
      listingType: "rent",
      status: "available",
      createdAt: 200,
    });
    await insertProperty({
      id: "00000000-0000-4000-8000-000000000213",
      title: "City Apartment",
      propertyType: "apartment",
      listingType: "sale",
      status: "sold",
      createdAt: 300,
    });
    await insertProperty({
      id: "00000000-0000-4000-8000-000000000214",
      title: "Second Marina Apartment",
      propertyType: "apartment",
      listingType: "sale",
      status: "available",
      createdAt: 400,
    });

    const response = await authenticatedRequest(
      "/api/properties?q=marina&listingType=sale&status=available&propertyType=apartment&page=1&pageSize=1",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        items: [{ title: "Second Marina Apartment" }],
        pagination: {
          page: 1,
          pageSize: 1,
          total: 2,
          totalPages: 2,
        },
      },
    });
  });

  it("treats SQL wildcard characters as literal search text", async () => {
    await insertProperty({
      id: "00000000-0000-4000-8000-000000000215",
      title: "100% Occupied Office",
      propertyType: "commercial",
      listingType: "rent",
      status: "rented",
      createdAt: 100,
    });
    await insertProperty({
      id: "00000000-0000-4000-8000-000000000216",
      title: "Ordinary Office",
      propertyType: "commercial",
      listingType: "rent",
      status: "available",
      createdAt: 200,
    });

    const response = await authenticatedRequest("/api/properties?q=%25");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        items: [{ title: "100% Occupied Office" }],
        pagination: { total: 1 },
      },
    });
  });

  it("rejects malformed filters and empty updates", async () => {
    const invalidFilterResponse = await authenticatedRequest(
      "/api/properties?page=0&pageSize=101&status=unknown",
    );
    const propertyId = await createProperty();
    const emptyUpdateResponse = await authenticatedRequest(
      `/api/properties/${propertyId}`,
      { method: "PATCH", body: "{}" },
    );

    expect(invalidFilterResponse.status).toBe(400);
    expect(emptyUpdateResponse.status).toBe(400);
  });
});

async function createProperty(): Promise<string> {
  const response = await authenticatedRequest("/api/properties", {
    method: "POST",
    body: JSON.stringify(validProperty),
  });
  const body: unknown = await response.json();

  if (!isCreatedPropertyBody(body)) {
    throw new Error("Expected a created property response.");
  }

  return body.data.property.id;
}

function isCreatedPropertyBody(
  body: unknown,
): body is { data: { property: { id: string } } } {
  if (!body || typeof body !== "object" || !("data" in body)) {
    return false;
  }

  const data = body.data;

  if (!data || typeof data !== "object" || !("property" in data)) {
    return false;
  }

  const property = data.property;

  return (
    property !== null &&
    typeof property === "object" &&
    "id" in property &&
    typeof property.id === "string"
  );
}

interface PropertySeed {
  id: string;
  title: string;
  propertyType: string;
  listingType: string;
  status: string;
  createdAt: number;
}

async function insertProperty(seed: PropertySeed): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO properties (
      id, title, property_type, listing_type, furnished, location, price,
      status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      seed.id,
      seed.title,
      seed.propertyType,
      seed.listingType,
      0,
      "Dubai Marina",
      500_000,
      seed.status,
      seed.createdAt,
      seed.createdAt,
    )
    .run();
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
