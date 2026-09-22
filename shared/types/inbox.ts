import type { z } from "zod";
import type {
  conversationListQuerySchema,
  inboxEventSchema,
  inboundMessageEventSchema,
  messageAttachmentSchema,
  messageListQuerySchema,
  messageStatusEnum,
  outboundMessageEventSchema,
  sendInboxMessageSchema,
  statusUpdateEventSchema,
} from "../schemas/inbox";

// --- Database Row Types ---

export interface ContactRow {
  id: string;
  phone_e164: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: number;
  updated_at: number;
}

export interface ConversationRow {
  id: string;
  contact_id: string;
  channel: string;
  last_message_at: number;
  last_message_preview: string | null;
  unread_count: number;
  created_at: number;
  updated_at: number;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  type: string;
  text: string | null;
  caption: string | null;
  provider_message_id: string | null;
  client_message_id: string | null;
  status: string;
  provider_timestamp: number | null;
  error_code: string | null;
  error_message: string | null;
  reply_to_provider_message_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface MessageAttachmentRow {
  id: string;
  message_id: string;
  r2_key: string;
  mime_type: string;
  filename: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  checksum: string | null;
  created_at: number;
}

export interface InboxEventRow {
  id: string;
  provider_event_id: string;
  event_type: string;
  idempotency_key: string;
  processed: number;
  created_at: number;
}

// --- API Response Types ---

export interface Contact {
  id: string;
  phoneE164: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface Conversation {
  id: string;
  contactId: string;
  channel: string;
  lastMessageAt: number;
  lastMessagePreview: string | null;
  unreadCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface ConversationListItem extends Conversation {
  contact: Contact;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  type: string;
  text: string | null;
  caption: string | null;
  providerMessageId: string | null;
  clientMessageId: string | null;
  status: MessageStatus;
  providerTimestamp: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  replyToProviderMessageId: string | null;
  attachments: MessageAttachment[];
  createdAt: number;
  updatedAt: number;
}

export type MessageStatus = z.output<typeof messageStatusEnum>;

export interface MessageAttachment {
  id: string;
  messageId: string;
  mimeType: string;
  filename: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
}

// --- Paginated Results ---

export interface PaginatedConversations {
  items: ConversationListItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PaginatedMessages {
  items: Message[];
  nextCursor: string | null;
  hasMore: boolean;
}

// --- Send Result ---

export interface SendResult {
  messageId: string;
  clientMessageId: string | null;
  status: "pending" | "sent";
}

// --- Event Processing Result ---

export interface EventProcessResult {
  eventId: string;
  duplicate: boolean;
}

// --- Derived Types from Schemas ---

export type InboxEvent = z.output<typeof inboxEventSchema>;
export type InboundMessageEvent = z.output<typeof inboundMessageEventSchema>;
export type StatusUpdateEvent = z.output<typeof statusUpdateEventSchema>;
export type OutboundMessageEvent = z.output<typeof outboundMessageEventSchema>;
export type SendInboxMessageInput = z.output<typeof sendInboxMessageSchema>;
export type ConversationListQuery = z.output<typeof conversationListQuerySchema>;
export type MessageListQuery = z.output<typeof messageListQuerySchema>;
export type MessageAttachmentInput = z.output<typeof messageAttachmentSchema>;

// --- Status Ordering ---

import { MESSAGE_STATUS_ORDER } from "../schemas/inbox";

export { MESSAGE_STATUS_ORDER };

export function canTransitionStatus(
  current: MessageStatus,
  next: MessageStatus,
): boolean {
  return MESSAGE_STATUS_ORDER[next] > MESSAGE_STATUS_ORDER[current];
}
