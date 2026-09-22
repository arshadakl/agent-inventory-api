import type { Contact, ContactRow } from "@shared/types/inbox";

export async function upsertContact(
  database: D1Database,
  phoneE164: string,
  displayName?: string,
): Promise<Contact> {
  const now = Math.floor(Date.now() / 1_000);

  const existing = await database
    .prepare("SELECT id FROM contacts WHERE phone_e164 = ?")
    .bind(phoneE164)
    .first<{ id: string }>();

  if (existing) {
    if (displayName) {
      await database
        .prepare(
          `UPDATE contacts SET display_name = ?, updated_at = ? WHERE id = ?`,
        )
        .bind(displayName, now, existing.id)
        .run();
    }

    return getContactById(database, existing.id);
  }

  const id = crypto.randomUUID();

  await database
    .prepare(
      `INSERT INTO contacts (id, phone_e164, display_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(id, phoneE164, displayName ?? null, now, now)
    .run();

  return getContactById(database, id);
}

export async function getContactById(
  database: D1Database,
  id: string,
): Promise<Contact> {
  const row = await database
    .prepare(
      `SELECT id, phone_e164, display_name, avatar_url, created_at, updated_at
       FROM contacts WHERE id = ?`,
    )
    .bind(id)
    .first<ContactRow>();

  if (!row) {
    throw new Error("Contact not found.");
  }

  return mapContact(row);
}

export async function findContactByPhone(
  database: D1Database,
  phoneE164: string,
): Promise<Contact | null> {
  const row = await database
    .prepare(
      `SELECT id, phone_e164, display_name, avatar_url, created_at, updated_at
       FROM contacts WHERE phone_e164 = ?`,
    )
    .bind(phoneE164)
    .first<ContactRow>();

  return row ? mapContact(row) : null;
}

export async function findContactById(
  database: D1Database,
  id: string,
): Promise<Contact> {
  return getContactById(database, id);
}

function mapContact(row: ContactRow): Contact {
  return {
    id: row.id,
    phoneE164: row.phone_e164,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  };
}
