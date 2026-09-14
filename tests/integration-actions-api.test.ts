import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

import app from "../worker/index";
import { hashSessionToken } from "../worker/lib/session";

const API_KEY_ID = "00000000-0000-4000-8000-000000000701";
const API_SECRET = "rei_live_integration-api-test-secret";
const SOURCE_PROPERTY_ID = "00000000-0000-4000-8000-000000000702";
const MATCHING_PROPERTY_ID = "00000000-0000-4000-8000-000000000703";

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM api_keys").run();
  const tokenHash = await hashSessionToken(API_SECRET);
  await env.DB.prepare(
    `INSERT INTO api_keys (id, name, key_prefix, token_hash)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(API_KEY_ID, "integration tests", "rei_live_integr", tokenHash)
    .run();
  await env.DB.prepare("DELETE FROM properties").run();
});

describe("n8n integration actions", () => {
  it("searches available Dubai listings with combined parameterized filters", async () => {
    await insertProperty({
      id: SOURCE_PROPERTY_ID,
      title: "Furnished Dubai Marina apartment",
      furnished: 1,
      location: "Dubai Marina",
      price: 89_000,
      bedrooms: 2,
    });
    await insertProperty({
      id: "00000000-0000-4000-8000-000000000704",
      title: "Unfurnished Dubai Marina apartment",
      furnished: 0,
      location: "Dubai Marina",
      price: 85_000,
      bedrooms: 2,
    });
    await insertProperty({
      id: "00000000-0000-4000-8000-000000000705",
      title: "Rented Dubai Marina apartment",
      furnished: 1,
      location: "Dubai Marina",
      price: 88_000,
      bedrooms: 2,
      status: "rented",
    });

    const response = await actionRequest({
      action: "search_properties",
      input: {
        location: "marina",
        listingType: "rent",
        furnished: true,
        bedrooms: 2,
        maxPrice: 90_000,
      },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      data: {
        action: "search_properties",
        result: {
          priceContext: { currency: "AED", rentalPeriod: "annual" },
          properties: [{ id: SOURCE_PROPERTY_ID, price: 89_000 }],
        },
      },
    });
  });

  it("gets properties, checks availability, and excludes unsuitable similarities", async () => {
    await insertProperty({
      id: SOURCE_PROPERTY_ID,
      title: "Source apartment",
      price: 100_000,
      bedrooms: 2,
    });
    await insertProperty({
      id: MATCHING_PROPERTY_ID,
      title: "Similar apartment",
      price: 110_000,
      bedrooms: 2,
    });
    await insertProperty({
      id: "00000000-0000-4000-8000-000000000706",
      title: "Unavailable apartment",
      price: 105_000,
      bedrooms: 2,
      status: "rented",
    });
    await insertProperty({
      id: "00000000-0000-4000-8000-000000000707",
      title: "Different type villa",
      price: 105_000,
      bedrooms: 2,
      propertyType: "villa",
    });

    const getResponse = await actionRequest({
      action: "get_property",
      input: { propertyId: SOURCE_PROPERTY_ID },
    });
    const availabilityResponse = await actionRequest({
      action: "check_availability",
      input: { propertyId: SOURCE_PROPERTY_ID },
    });
    const similarResponse = await actionRequest({
      action: "similar_properties",
      input: { propertyId: SOURCE_PROPERTY_ID },
    });

    expect(await getResponse.json()).toMatchObject({
      data: { result: { property: { id: SOURCE_PROPERTY_ID } } },
    });
    expect(await availabilityResponse.json()).toMatchObject({
      data: {
        result: {
          propertyId: SOURCE_PROPERTY_ID,
          status: "available",
          available: true,
        },
      },
    });
    expect(await similarResponse.json()).toMatchObject({
      data: { result: { properties: [{ id: MATCHING_PROPERTY_ID }] } },
    });
  });

  it("rejects missing keys and invalid actions and returns 404 for missing properties", async () => {
    const unauthorizedResponse = await app.request(
      "https://inventory.example.com/api/v1/actions/execute",
      { method: "POST" },
      env,
    );
    const invalidResponse = await actionRequest({
      action: "unknown",
      input: {},
    });
    const missingResponse = await actionRequest({
      action: "get_property",
      input: { propertyId: "00000000-0000-4000-8000-000000000799" },
    });

    expect(unauthorizedResponse.status).toBe(401);
    expect(invalidResponse.status).toBe(400);
    expect(missingResponse.status).toBe(404);
  });
});

function actionRequest(body: unknown): Promise<Response> {
  return Promise.resolve(
    app.request(
      "https://inventory.example.com/api/v1/actions/execute",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      env,
    ),
  );
}

interface PropertySeed {
  id: string;
  title: string;
  furnished?: 0 | 1;
  location?: string;
  price: number;
  bedrooms: number;
  propertyType?: "apartment" | "villa";
  status?: "available" | "rented";
}

async function insertProperty(property: PropertySeed): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO properties (
      id, title, property_type, listing_type, furnished, location, price,
      bedrooms, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      property.id,
      property.title,
      property.propertyType ?? "apartment",
      "rent",
      property.furnished ?? 1,
      property.location ?? "Dubai Marina",
      property.price,
      property.bedrooms,
      property.status ?? "available",
      1,
      1,
    )
    .run();
}
