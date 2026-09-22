-- Inbox schema: contacts, conversations, messages, attachments, events
PRAGMA foreign_keys = ON;

-- Extend api_keys with scopes for inbox access control
ALTER TABLE api_keys ADD COLUMN scopes TEXT DEFAULT NULL;

-- Contacts table (one row per unique phone number)
CREATE TABLE contacts (
  id TEXT PRIMARY KEY NOT NULL,
  phone_e164 TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_contacts_phone ON contacts(phone_e164);

-- Conversations table (one per contact per channel)
CREATE TABLE conversations (
  id TEXT PRIMARY KEY NOT NULL,
  contact_id TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  last_message_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_message_preview TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE INDEX idx_conversations_contact ON conversations(contact_id);
CREATE INDEX idx_conversations_last_message_at ON conversations(last_message_at DESC);
CREATE INDEX idx_conversations_unread ON conversations(unread_count) WHERE unread_count > 0;

-- Messages table
CREATE TABLE messages (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  type TEXT NOT NULL CHECK (type IN ('text', 'image', 'video', 'audio', 'document', 'sticker')),
  text TEXT,
  caption TEXT,
  provider_message_id TEXT,
  client_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'unknown')),
  provider_timestamp INTEGER,
  error_code TEXT,
  error_message TEXT,
  reply_to_provider_message_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_provider_id ON messages(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX idx_messages_client_id ON messages(client_message_id) WHERE client_message_id IS NOT NULL;
CREATE INDEX idx_messages_status ON messages(status);

-- Message attachments table
CREATE TABLE message_attachments (
  id TEXT PRIMARY KEY NOT NULL,
  message_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  filename TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  width INTEGER CHECK (width IS NULL OR width > 0),
  height INTEGER CHECK (height IS NULL OR height > 0),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  checksum TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE INDEX idx_attachments_message ON message_attachments(message_id);

-- Inbox events table (duplicate webhook protection)
CREATE TABLE inbox_events (
  id TEXT PRIMARY KEY NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  processed INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_inbox_events_idempotency ON inbox_events(idempotency_key);
CREATE INDEX idx_inbox_events_provider ON inbox_events(provider_event_id);
