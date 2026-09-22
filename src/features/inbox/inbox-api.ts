import { z } from "zod";

import type {
  ConversationListQuery,
  MessageListQuery,
  SendInboxMessageInput,
} from "@shared/schemas/inbox";

const contactSchema = z.object({
  id: z.string(),
  phoneE164: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

const conversationListItemSchema = z.object({
  id: z.string(),
  contactId: z.string(),
  channel: z.string(),
  lastMessageAt: z.number(),
  lastMessagePreview: z.string().nullable(),
  unreadCount: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
  contact: contactSchema,
});

const paginatedConversationsSchema = z.object({
  items: z.array(conversationListItemSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

const messageAttachmentSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  mimeType: z.string(),
  filename: z.string(),
  byteSize: z.number(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  durationMs: z.number().nullable(),
});

const messageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  direction: z.enum(["inbound", "outbound"]),
  type: z.string(),
  text: z.string().nullable(),
  caption: z.string().nullable(),
  providerMessageId: z.string().nullable(),
  clientMessageId: z.string().nullable(),
  status: z.string(),
  providerTimestamp: z.number().nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  replyToProviderMessageId: z.string().nullable(),
  attachments: z.array(messageAttachmentSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const paginatedMessagesSchema = z.object({
  items: z.array(messageSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

const sendResultSchema = z.object({
  messageId: z.string(),
  clientMessageId: z.string().nullable(),
  status: z.string(),
});

const attachmentResultSchema = z.object({
  data: z.object({
    attachment: z.object({
      id: z.string(),
      messageId: z.string(),
      mimeType: z.string(),
      filename: z.string(),
      byteSize: z.number(),
      width: z.number().nullable(),
      height: z.number().nullable(),
      durationMs: z.number().nullable(),
    }),
  }),
});

import { apiRequest, apiRequestVoid, ApiClientError } from "@/lib/api-client";

export async function getConversations(query: ConversationListQuery) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.unreadOnly) params.set("unreadOnly", "true");
  if (query.before) params.set("before", query.before);
  if (query.after) params.set("after", query.after);
  params.set("limit", String(query.limit));

  return apiRequest(
    `/api/inbox/conversations?${params.toString()}`,
    paginatedConversationsSchema,
  );
}

export async function getMessages(
  conversationId: string,
  query: MessageListQuery,
) {
  const params = new URLSearchParams();
  if (query.before) params.set("before", query.before);
  if (query.after) params.set("after", query.after);
  params.set("limit", String(query.limit));

  return apiRequest(
    `/api/inbox/conversations/${conversationId}/messages?${params.toString()}`,
    paginatedMessagesSchema,
  );
}

export async function sendMessage(
  conversationId: string,
  input: SendInboxMessageInput,
) {
  return apiRequest(
    `/api/inbox/conversations/${conversationId}/messages`,
    sendResultSchema,
    { method: "POST", body: input },
  );
}

export async function markConversationRead(conversationId: string) {
  return apiRequestVoid(
    `/api/inbox/conversations/${conversationId}/read`,
    { method: "POST" },
  );
}

export async function uploadMedia(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/inbox/media", {
    method: "POST",
    body: formData,
    credentials: "same-origin",
  });

  if (!response.ok) {
    let errorMessage = "Media upload failed.";
    try {
      const errorBody = await response.json();
      if (errorBody?.error?.message) {
        errorMessage = errorBody.error.message;
      }
    } catch {
      // Use default message
    }
    throw new ApiClientError(response.status, "VALIDATION_ERROR", errorMessage);
  }

  const body = await response.json();
  return attachmentResultSchema.parse(body).data.attachment;
}

export type ConversationListItem = z.output<typeof conversationListItemSchema>;
export type Message = z.output<typeof messageSchema>;
export type MessageAttachment = z.output<typeof messageAttachmentSchema>;
