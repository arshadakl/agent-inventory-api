import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

import app from "../worker/index";
import { hashSessionToken } from "../worker/lib/session";

const API_KEY_ID = "00000000-0000-4000-8000-000000000801";
const API_SECRET = "rei_live_inbox-api-test-secret";

const N8N_PAYLOAD = {
  eventId: "wamid.HBgMOTE4NTg5ODQwMDczFQIAEhgUM0FBNjMwNENEQjEyOTFGQTIxRjkA",
  eventType: "message.received",
  provider: "whatsapp-cloud",
  channel: "whatsapp",
  occurredAt: new Date().toISOString(),
  contact: { phoneE164: "+919589480171" },
  message: {
    providerMessageId:
      "wamid.HBgMOTE4NTg5ODQwMDczFQIAEhgUM0FBNjMwNENEQjEyOTFGQTIxRjkA",
    type: "text",
    text: "hi",
    caption: null,
    attachmentIds: [],
    replyToProviderMessageId: null,
    providerTimestamp: new Date().toISOString(),
  },
};

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM api_keys").run();
  await env.DB.prepare("DELETE FROM contacts").run();
  const tokenHash = await hashSessionToken(API_SECRET);
  await env.DB.prepare(
    `INSERT INTO api_keys (id, name, key_prefix, token_hash, scopes)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(
      API_KEY_ID,
      "inbox test",
      "rei_live_inboxt",
      tokenHash,
      JSON.stringify(["inbox:write"]),
    )
    .run();
});

describe("inbox events endpoint", () => {
  it("accepts the exact n8n payload shape", async () => {
    const response = await app.request(
      "https://inventory.example.com/api/v1/inbox/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(N8N_PAYLOAD),
      },
      env,
    );
    const body = await response.json();
    console.log("STATUS:", response.status, "BODY:", JSON.stringify(body));
    expect(response.status).toBe(200);

    const msg = await env.DB.prepare(
      "SELECT id, direction, text, provider_message_id FROM messages",
    ).first();
    expect(msg).toMatchObject({
      direction: "inbound",
      text: "hi",
      provider_message_id: N8N_PAYLOAD.message.providerMessageId,
    });
  });

  it("stores an outbound message from a message.sent event", async () => {
    const sentPayload = {
      eventId: "sent-test-1",
      eventType: "message.sent",
      provider: "whatsapp-cloud",
      channel: "whatsapp",
      occurredAt: new Date().toISOString(),
      to: { phoneE164: "+918589840073" },
      message: {
        providerMessageId: "wamid.sent-test-1",
        type: "text",
        text: "Hello! How can I help you today?",
        attachmentIds: [],
        statusAt: new Date().toISOString(),
      },
    };

    const response = await app.request(
      "https://inventory.example.com/api/v1/inbox/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sentPayload),
      },
      env,
    );
    expect(response.status).toBe(200);

    const msg = await env.DB.prepare(
      "SELECT direction, text, status, provider_message_id FROM messages",
    ).first();
    expect(msg).toMatchObject({
      direction: "outbound",
      text: "Hello! How can I help you today?",
      status: "sent",
      provider_message_id: "wamid.sent-test-1",
    });
  });

  it("rejects a key without inbox:write scope", async () => {
    const tokenHash = await hashSessionToken("rei_live_no-scope-secret");
    await env.DB.prepare(
      `INSERT INTO api_keys (id, name, key_prefix, token_hash, scopes)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(
        "00000000-0000-4000-8000-000000000802",
        "no scope",
        "rei_live_noscop",
        tokenHash,
        JSON.stringify(["inbox:read"]),
      )
      .run();

    const response = await app.request(
      "https://inventory.example.com/api/v1/inbox/events",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer rei_live_no-scope-secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(N8N_PAYLOAD),
      },
      env,
    );
    expect(response.status).toBe(403);
  });
});