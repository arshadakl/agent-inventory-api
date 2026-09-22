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
  await env.DB.prepare("DELETE FROM messages").run();
  await env.DB.prepare("DELETE FROM conversations").run();
  await env.DB.prepare("DELETE FROM contacts").run();
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

  it("returns recent conversation history for a known phone", async () => {
    await seedConversationMessages();

    const response = await actionRequest({
      action: "get_conversation_history",
      input: { phoneE164: "+971555000001", limit: 10, withinMinutes: 60 },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      data: {
        action: "get_conversation_history",
        result: {
          messages: [
            { direction: "outbound", text: "Hello!" },
            { direction: "inbound", text: "hi" },
          ],
        },
      },
    });
  });

  it("filters out messages older than the time window", async () => {
    await seedConversationMessages({ oldCreatedAt: 1 });

    const response = await actionRequest({
      action: "get_conversation_history",
      input: { phoneE164: "+971555000001", limit: 10, withinMinutes: 30 },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    const messages = (
      body as {
        data: { result: { messages: { text: string }[] } };
      }
    ).data.result.messages;
    const texts = messages.map((m) => m.text);
    expect(texts).not.toContain("old message");
    expect(texts).toContain("hi");
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

async function seedConversationMessages(options?: {
  oldCreatedAt?: number;
}): Promise<void> {
  const now = Math.floor(Date.now() / 1_000);
  const contactId = "00000000-0000-4000-8000-000000000721";
  const conversationId = "00000000-0000-4000-8000-000000000722";

  await env.DB.prepare(
    `INSERT INTO contacts (id, phone_e164, display_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(contactId, "+971555000001", "Test User", now, now)
    .run();

  await env.DB.prepare(
    `INSERT INTO conversations (id, contact_id, channel, last_message_at, last_message_preview, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      conversationId,
      contactId,
      "whatsapp",
      now,
      "hi",
      now,
      now,
    )
    .run();

  await insertHistoryMessage(conversationId, now - 5, "inbound", "hi");
  await insertHistoryMessage(conversationId, now - 10, "outbound", "Hello!");

  if (options?.oldCreatedAt !== undefined) {
    await insertHistoryMessage(
      conversationId,
      options.oldCreatedAt,
      "inbound",
      "old message",
    );
  }
}

async function insertHistoryMessage(
  conversationId: string,
  createdAt: number,
  direction: "inbound" | "outbound",
  text: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO messages (
      id, conversation_id, direction, type, text, caption,
      provider_message_id, client_message_id, status, provider_timestamp,
      reply_to_provider_message_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      conversationId,
      direction,
      "text",
      text,
      null,
      null,
      null,
      "delivered",
      createdAt,
      null,
      createdAt,
      createdAt,
    )
    .run();
}
