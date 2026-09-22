import type {
  Conversation,
  ConversationListQuery,
  ConversationRow,
  ContactRow,
  PaginatedConversations,
} from "@shared/types/inbox";

export async function upsertConversation(
  database: D1Database,
  contactId: string,
  channel: string,
  lastMessagePreview: string | null,
  lastMessageAt: number,
): Promise<Conversation> {
  const now = Math.floor(Date.now() / 1_000);

  const existing = await database
    .prepare(
      `SELECT id FROM conversations WHERE contact_id = ? AND channel = ?`,
    )
    .bind(contactId, channel)
    .first<{ id: string }>();

  if (existing) {
    await database
      .prepare(
        `UPDATE conversations
         SET last_message_at = ?, last_message_preview = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(lastMessageAt, lastMessagePreview, now, existing.id)
      .run();

    return getConversationById(database, existing.id);
  }

  const id = crypto.randomUUID();

  await database
    .prepare(
      `INSERT INTO conversations (id, contact_id, channel, last_message_at, last_message_preview, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, contactId, channel, lastMessageAt, lastMessagePreview, now, now)
    .run();

  return getConversationById(database, id);
}

export async function getConversationById(
  database: D1Database,
  id: string,
): Promise<Conversation> {
  const row = await database
    .prepare(
      `SELECT id, contact_id, channel, last_message_at, last_message_preview,
              unread_count, created_at, updated_at
       FROM conversations WHERE id = ?`,
    )
    .bind(id)
    .first<ConversationRow>();

  if (!row) {
    throw new Error("Conversation not found.");
  }

  return mapConversation(row);
}

export async function getContactIdByConversation(
  database: D1Database,
  conversationId: string,
): Promise<string> {
  const row = await database
    .prepare("SELECT contact_id FROM conversations WHERE id = ?")
    .bind(conversationId)
    .first<{ contact_id: string }>();

  if (!row) {
    throw new Error("Conversation not found.");
  }

  return row.contact_id;
}

export async function listConversations(
  database: D1Database,
  query: ConversationListQuery,
): Promise<PaginatedConversations> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query.q) {
    conditions.push(
      `(c.contact_id IN (SELECT id FROM contacts WHERE phone_e164 LIKE ? ESCAPE '\\' OR display_name LIKE ? ESCAPE '\\'))`,
    );
    const like = `%${escapeLike(query.q)}%`;
    params.push(like, like);
  }

  if (query.unreadOnly) {
    conditions.push(`c.unread_count > 0`);
  }

  if (query.before) {
    conditions.push(`c.last_message_at < (SELECT last_message_at FROM conversations WHERE id = ?)`);
    params.push(query.before);
  }

  if (query.after) {
    conditions.push(`c.last_message_at > (SELECT last_message_at FROM conversations WHERE id = ?)`);
    params.push(query.after);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const limit = query.limit + 1;

  const result = await database
    .prepare(
      `SELECT c.id, c.contact_id, c.channel, c.last_message_at, c.last_message_preview,
              c.unread_count, c.created_at, c.updated_at,
              co.id AS contact_id_ref, co.phone_e164, co.display_name, co.avatar_url
       FROM conversations c
       JOIN contacts co ON co.id = c.contact_id
       ${whereClause}
       ORDER BY c.last_message_at DESC
       LIMIT ?`,
    )
    .bind(...params, limit)
    .all<ConversationRow & ContactRow & { contact_id_ref: string }>();

  const hasMore = result.results.length >= limit;
  const items = result.results.slice(0, query.limit);

  const lastItem = hasMore && items.length > 0 ? items[items.length - 1] : null;
  const nextCursor = lastItem?.id ?? null;

  return {
    items: items.map((row) => ({
      ...mapConversation({
        id: row.id,
        contact_id: row.contact_id,
        channel: row.channel,
        last_message_at: row.last_message_at,
        last_message_preview: row.last_message_preview,
        unread_count: row.unread_count,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }),
      contact: {
        id: row.contact_id_ref,
        phoneE164: row.phone_e164,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
      },
    })),
    nextCursor,
    hasMore,
  };
}

export async function incrementUnread(
  database: D1Database,
  conversationId: string,
): Promise<void> {
  await database
    .prepare(
      `UPDATE conversations SET unread_count = unread_count + 1, updated_at = unixepoch() WHERE id = ?`,
    )
    .bind(conversationId)
    .run();
}

export async function clearUnread(
  database: D1Database,
  conversationId: string,
): Promise<void> {
  await database
    .prepare(
      `UPDATE conversations SET unread_count = 0, updated_at = unixepoch() WHERE id = ? AND unread_count > 0`,
    )
    .bind(conversationId)
    .run();
}

function mapConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    contactId: row.contact_id,
    channel: row.channel,
    lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview,
    unreadCount: row.unread_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}
