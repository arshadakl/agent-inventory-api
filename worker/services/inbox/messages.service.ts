import type {
  Message,
  MessageAttachment,
  MessageAttachmentRow,
  MessageListQuery,
  MessageRow,
  MessageStatus,
  PaginatedMessages,
} from "@shared/types/inbox";
import { canTransitionStatus } from "@shared/types/inbox";

const VALID_STATUSES = new Set([
  "pending",
  "sent",
  "delivered",
  "read",
  "failed",
  "unknown",
]);

export async function insertMessage(
  database: D1Database,
  input: {
    conversationId: string;
    direction: "inbound" | "outbound";
    type: string;
    text?: string | null;
    caption?: string | null;
    providerMessageId?: string | null;
    clientMessageId?: string | null;
    status?: MessageStatus;
    providerTimestamp?: number | null;
    replyToProviderMessageId?: string | null;
  },
): Promise<Message> {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1_000);

  await database
    .prepare(
      `INSERT INTO messages (
        id, conversation_id, direction, type, text, caption,
        provider_message_id, client_message_id, status, provider_timestamp,
        reply_to_provider_message_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.conversationId,
      input.direction,
      input.type,
      input.text ?? null,
      input.caption ?? null,
      input.providerMessageId ?? null,
      input.clientMessageId ?? null,
      input.status ?? "unknown",
      input.providerTimestamp ?? null,
      input.replyToProviderMessageId ?? null,
      now,
      now,
    )
    .run();

  return getMessageById(database, id);
}

export async function getMessageById(
  database: D1Database,
  id: string,
): Promise<Message> {
  const row = await database
    .prepare(
      `SELECT id, conversation_id, direction, type, text, caption,
              provider_message_id, client_message_id, status, provider_timestamp,
              error_code, error_message, reply_to_provider_message_id,
              created_at, updated_at
       FROM messages WHERE id = ?`,
    )
    .bind(id)
    .first<MessageRow>();

  if (!row) {
    throw new Error("Message not found.");
  }

  const attachments = await getAttachmentsByMessageId(database, id);
  return mapMessage(row, attachments);
}

export async function findMessageByProviderId(
  database: D1Database,
  providerMessageId: string,
): Promise<Message | null> {
  const row = await database
    .prepare(
      `SELECT id, conversation_id, direction, type, text, caption,
              provider_message_id, client_message_id, status, provider_timestamp,
              error_code, error_message, reply_to_provider_message_id,
              created_at, updated_at
       FROM messages WHERE provider_message_id = ?`,
    )
    .bind(providerMessageId)
    .first<MessageRow>();

  if (!row) return null;

  const attachments = await getAttachmentsByMessageId(database, row.id);
  return mapMessage(row, attachments);
}

export async function findMessageByClientId(
  database: D1Database,
  clientMessageId: string,
): Promise<Message | null> {
  const row = await database
    .prepare(
      `SELECT id, conversation_id, direction, type, text, caption,
              provider_message_id, client_message_id, status, provider_timestamp,
              error_code, error_message, reply_to_provider_message_id,
              created_at, updated_at
       FROM messages WHERE client_message_id = ?`,
    )
    .bind(clientMessageId)
    .first<MessageRow>();

  if (!row) return null;

  const attachments = await getAttachmentsByMessageId(database, row.id);
  return mapMessage(row, attachments);
}

export async function updateMessageStatus(
  database: D1Database,
  providerMessageId: string,
  newStatus: MessageStatus,
  errorCode?: string | null,
  errorMessage?: string | null,
): Promise<Message | null> {
  const existing = await findMessageByProviderId(database, providerMessageId);
  if (!existing) return null;

  if (!canTransitionStatus(existing.status, newStatus)) {
    return existing;
  }

  const now = Math.floor(Date.now() / 1_000);

  await database
    .prepare(
      `UPDATE messages
       SET status = ?, error_code = ?, error_message = ?, updated_at = ?
       WHERE provider_message_id = ?`,
    )
    .bind(
      newStatus,
      errorCode ?? null,
      errorMessage ?? null,
      now,
      providerMessageId,
    )
    .run();

  return getMessageById(database, existing.id);
}

export async function setProviderMessageId(
  database: D1Database,
  messageId: string,
  providerMessageId: string,
  status: MessageStatus,
): Promise<void> {
  const now = Math.floor(Date.now() / 1_000);

  await database
    .prepare(
      `UPDATE messages
       SET provider_message_id = ?, status = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(providerMessageId, status, now, messageId)
    .run();
}

export async function updateMessageStatusById(
  database: D1Database,
  messageId: string,
  newStatus: MessageStatus,
  errorCode: string | null,
  errorMessage: string | null,
): Promise<void> {
  const now = Math.floor(Date.now() / 1_000);

  await database
    .prepare(
      `UPDATE messages
       SET status = ?, error_code = ?, error_message = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(newStatus, errorCode, errorMessage, now, messageId)
    .run();
}

export async function listMessages(
  database: D1Database,
  conversationId: string,
  query: MessageListQuery,
): Promise<PaginatedMessages> {
  const conditions = ["conversation_id = ?"];
  const params: unknown[] = [conversationId];

  if (query.before) {
    conditions.push("created_at < (SELECT created_at FROM messages WHERE id = ?)");
    params.push(query.before);
  }

  if (query.after) {
    conditions.push("created_at > (SELECT created_at FROM messages WHERE id = ?)");
    params.push(query.after);
  }

  const whereClause = conditions.join(" AND ");
  const limit = query.limit + 1;

  const result = await database
    .prepare(
      `SELECT id, conversation_id, direction, type, text, caption,
              provider_message_id, client_message_id, status, provider_timestamp,
              error_code, error_message, reply_to_provider_message_id,
              created_at, updated_at
       FROM messages
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(...params, limit)
    .all<MessageRow>();

  const hasMore = result.results.length >= limit;
  const rows = result.results.slice(0, query.limit);

  const items = await Promise.all(
    rows.map(async (row) => {
      const attachments = await getAttachmentsByMessageId(database, row.id);
      return mapMessage(row, attachments);
    }),
  );

  const lastItem = hasMore && items.length > 0 ? items[items.length - 1] : null;
  const nextCursor = lastItem?.id ?? null;

  return { items, nextCursor, hasMore };
}

export async function getAttachmentsByMessageId(
  database: D1Database,
  messageId: string,
): Promise<MessageAttachment[]> {
  const result = await database
    .prepare(
      `SELECT id, message_id, mime_type, filename, byte_size, width, height, duration_ms
       FROM message_attachments WHERE message_id = ?`,
    )
    .bind(messageId)
    .all<MessageAttachmentRow>();

  return result.results.map((row) => ({
    id: row.id,
    messageId: row.message_id,
    mimeType: row.mime_type,
    filename: row.filename,
    byteSize: row.byte_size,
    width: row.width,
    height: row.height,
    durationMs: row.duration_ms,
  }));
}

export async function insertAttachment(
  database: D1Database,
  input: {
    messageId: string;
    r2Key: string;
    mimeType: string;
    filename: string;
    byteSize: number;
    width?: number | null;
    height?: number | null;
    durationMs?: number | null;
    checksum?: string | null;
  },
): Promise<MessageAttachment> {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1_000);

  await database
    .prepare(
      `INSERT INTO message_attachments (
        id, message_id, r2_key, mime_type, filename, byte_size,
        width, height, duration_ms, checksum, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.messageId,
      input.r2Key,
      input.mimeType,
      input.filename,
      input.byteSize,
      input.width ?? null,
      input.height ?? null,
      input.durationMs ?? null,
      input.checksum ?? null,
      now,
    )
    .run();

  return {
    id,
    messageId: input.messageId,
    mimeType: input.mimeType,
    filename: input.filename,
    byteSize: input.byteSize,
    width: input.width ?? null,
    height: input.height ?? null,
    durationMs: input.durationMs ?? null,
  };
}

export async function getAttachmentById(
  database: D1Database,
  attachmentId: string,
): Promise<{ r2Key: string; mimeType: string; filename: string } | null> {
  return database
    .prepare(
      `SELECT r2_key, mime_type, filename FROM message_attachments WHERE id = ?`,
    )
    .bind(attachmentId)
    .first<{ r2Key: string; mimeType: string; filename: string }>();
}

function mapMessage(row: MessageRow, attachments: MessageAttachment[]): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    direction: row.direction,
    type: row.type,
    text: row.text,
    caption: row.caption,
    providerMessageId: row.provider_message_id,
    clientMessageId: row.client_message_id,
    status: VALID_STATUSES.has(row.status)
      ? (row.status as MessageStatus)
      : "unknown",
    providerTimestamp: row.provider_timestamp,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    replyToProviderMessageId: row.reply_to_provider_message_id,
    attachments,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
