import { z } from "zod";

// --- Enums ---

export const messageDirectionEnum = z.enum(["inbound", "outbound"]);
export type MessageDirection = z.output<typeof messageDirectionEnum>;

export const messageTypeEnum = z.enum([
  "text",
  "image",
  "video",
  "audio",
  "document",
  "sticker",
]);
export type MessageType = z.output<typeof messageTypeEnum>;

export const messageStatusEnum = z.enum([
  "pending",
  "sent",
  "delivered",
  "read",
  "failed",
  "unknown",
]);
export type MessageStatus = z.output<typeof messageStatusEnum>;

export const MESSAGE_STATUS_ORDER: Record<MessageStatus, number> = {
  unknown: -1,
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4,
};

export const inboxEventTypeEnum = z.enum([
  "message.received",
  "message.status.updated",
  "message.sent",
]);
export type InboxEventType = z.output<typeof inboxEventTypeEnum>;

// --- API Key Scopes ---

export const inboxScopeEnum = z.enum([
  "inbox:read",
  "inbox:write",
  "inbox:media:read",
  "inbox:media:write",
]);
export type InboxScope = z.output<typeof inboxScopeEnum>;

// --- Contact & Message Schemas ---

export const phoneE164Schema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{1,14}$/, "Must be a valid E.164 phone number.");

export const contactInputSchema = z.object({
  phoneE164: phoneE164Schema,
  displayName: z.string().trim().max(100).optional(),
});

export const messageAttachmentSchema = z.object({
  id: z.string().uuid(),
  mimeType: z.string(),
  filename: z.string(),
  byteSize: z.number().int().nonnegative(),
});

// --- Inbound Event Schemas (n8n -> Worker) ---

export const inboundMessageEventSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.literal("message.received"),
  provider: z.string().min(1),
  channel: z.literal("whatsapp"),
  occurredAt: z.string().datetime(),
  contact: contactInputSchema,
  message: z.object({
    providerMessageId: z.string().min(1),
    type: messageTypeEnum,
    text: z.string().nullable().optional(),
    caption: z.string().nullable().optional(),
    attachmentIds: z.array(z.string().uuid()).default([]),
    replyToProviderMessageId: z.string().nullable().optional(),
    providerTimestamp: z.string().datetime(),
  }),
});

export const statusUpdateEventSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.literal("message.status.updated"),
  provider: z.string().min(1),
  channel: z.literal("whatsapp").optional(),
  occurredAt: z.string().datetime().optional(),
  message: z.object({
    providerMessageId: z.string().min(1),
    status: messageStatusEnum.exclude(["pending", "unknown"]),
    statusAt: z.string().datetime(),
    errorCode: z.string().nullable().optional(),
    errorMessage: z.string().nullable().optional(),
  }),
});

export const outboundMessageEventSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.literal("message.sent"),
  provider: z.string().min(1),
  channel: z.literal("whatsapp"),
  occurredAt: z.string().datetime(),
  to: z.object({ phoneE164: phoneE164Schema }),
  message: z.object({
    providerMessageId: z.string().min(1),
    type: messageTypeEnum,
    text: z.string().nullable().optional(),
    caption: z.string().nullable().optional(),
    attachmentIds: z.array(z.string().uuid()).default([]),
    replyToProviderMessageId: z.string().nullable().optional(),
    statusAt: z.string().datetime(),
  }),
});

export const inboxEventSchema = z.discriminatedUnion("eventType", [
  inboundMessageEventSchema,
  statusUpdateEventSchema,
  outboundMessageEventSchema,
]);

export type InboundMessageEvent = z.output<typeof inboundMessageEventSchema>;
export type StatusUpdateEvent = z.output<typeof statusUpdateEventSchema>;
export type OutboundMessageEvent = z.output<typeof outboundMessageEventSchema>;
export type InboxEvent = z.output<typeof inboxEventSchema>;

// --- Outbound Send (Dashboard -> Worker -> n8n) ---

export const sendInboxMessageSchema = z.object({
  text: z
    .string()
    .trim()
    .max(4096, "Message must be 4096 characters or fewer.")
    .optional(),
  attachmentIds: z.array(z.string().uuid()).max(10).default([]),
  clientMessageId: z.string().uuid().optional(),
});

export type SendInboxMessageInput = z.output<typeof sendInboxMessageSchema>;

// --- Conversation List Query ---

export const conversationListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => v || undefined),
  unreadOnly: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
  before: z.string().optional(),
  after: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ConversationListQuery = z.output<typeof conversationListQuerySchema>;

// --- Message List Query ---

export const messageListQuerySchema = z.object({
  before: z.string().uuid().optional(),
  after: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type MessageListQuery = z.output<typeof messageListQuerySchema>;

// --- n8n Outbound Payload ---

export const n8nOutboundPayloadSchema = z.object({
  requestId: z.string().uuid(),
  channel: z.literal("whatsapp"),
  to: z.object({
    phoneE164: phoneE164Schema,
  }),
  message: z.object({
    type: messageTypeEnum,
    text: z.string().optional(),
    attachmentIds: z.array(z.string().uuid()),
  }),
  callback: z.object({
    eventEndpoint: z.string(),
  }),
});

export type N8nOutboundPayload = z.output<typeof n8nOutboundPayloadSchema>;
