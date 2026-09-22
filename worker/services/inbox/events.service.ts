import type {
  InboxEvent,
  InboundMessageEvent,
  StatusUpdateEvent,
  EventProcessResult,
} from "@shared/types/inbox";

import { upsertContact } from "./contacts.service";
import {
  upsertConversation,
  incrementUnread,
} from "./conversations.service";
import {
  insertMessage,
  findMessageByProviderId,
  updateMessageStatus,
} from "./messages.service";

function currentUnixTime(): number {
  return Math.floor(Date.now() / 1_000);
}

function parseTimestamp(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1_000);
}

export async function processInboxEvent(
  database: D1Database,
  event: InboxEvent,
): Promise<EventProcessResult> {
  const idempotencyKey = `${event.provider}:${event.eventId}`;

  const existing = await database
    .prepare("SELECT id FROM inbox_events WHERE idempotency_key = ?")
    .bind(idempotencyKey)
    .first<{ id: string }>();

  if (existing) {
    return { eventId: event.eventId, duplicate: true };
  }

  const eventRowId = crypto.randomUUID();
  const now = currentUnixTime();

  await database
    .prepare(
      `INSERT INTO inbox_events (id, provider_event_id, event_type, idempotency_key, processed, created_at)
       VALUES (?, ?, ?, ?, 1, ?)`,
    )
    .bind(eventRowId, event.eventId, event.eventType, idempotencyKey, now)
    .run();

  if (event.eventType === "message.received") {
    await handleInboundMessage(database, event);
  } else if (event.eventType === "message.status.updated") {
    await handleStatusUpdate(database, event);
  }

  return { eventId: event.eventId, duplicate: false };
}

async function handleInboundMessage(
  database: D1Database,
  event: InboundMessageEvent,
): Promise<void> {
  const contact = await upsertContact(
    database,
    event.contact.phoneE164,
    event.contact.displayName,
  );

  const conversation = await upsertConversation(
    database,
    contact.id,
    event.channel,
    event.message.text ?? event.message.caption ?? null,
    parseTimestamp(event.message.providerTimestamp),
  );

  const existingMsg = await findMessageByProviderId(
    database,
    event.message.providerMessageId,
  );

  if (!existingMsg) {
    await insertMessage(database, {
      conversationId: conversation.id,
      direction: "inbound",
      type: event.message.type,
      text: event.message.text ?? null,
      caption: event.message.caption ?? null,
      providerMessageId: event.message.providerMessageId,
      providerTimestamp: parseTimestamp(event.message.providerTimestamp),
      replyToProviderMessageId: event.message.replyToProviderMessageId ?? null,
      status: "delivered",
    });

    await incrementUnread(database, conversation.id);
  }
}

async function handleStatusUpdate(
  database: D1Database,
  event: StatusUpdateEvent,
): Promise<void> {
  await updateMessageStatus(
    database,
    event.message.providerMessageId,
    event.message.status,
    event.message.errorCode,
    event.message.errorMessage,
  );
}
