import {
  conversationListQuerySchema,
  messageListQuerySchema,
  sendInboxMessageSchema,
} from "@shared/schemas/inbox";
import type { ApiData } from "@shared/types/api";
import type {
  PaginatedConversations,
  PaginatedMessages,
  SendResult,
} from "@shared/types/inbox";
import { Hono } from "hono";

import type { WorkerEnvironment } from "../env";
import { readJsonBody } from "../lib/request";
import { errorResponse, getZodFieldErrors } from "../lib/response";
import {
  clearUnread,
  getConversationById,
  getContactIdByConversation,
  listConversations,
} from "../services/inbox/conversations.service";
import {
  insertMessage,
  findMessageByClientId,
  listMessages,
  getAttachmentById,
  insertAttachment,
  updateMessageStatusById,
  setProviderMessageId,
} from "../services/inbox/messages.service";
import {
  sendToN8n,
  buildOutboundPayload,
  N8nSendError,
} from "../services/inbox/n8n-adapter";
import {
  uploadToR2,
  isAllowedMimeType,
  isUnderSizeLimit,
  buildR2Key,
} from "../services/inbox/media.service";
import { findContactById } from "../services/inbox/contacts.service";

const uuidSchema =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const inboxRoutes = new Hono<WorkerEnvironment>();

// --- Conversations ---

inboxRoutes.get("/conversations", async (context) => {
  const parsed = conversationListQuerySchema.safeParse(context.req.query());

  if (!parsed.success) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "Invalid conversation filters.",
      getZodFieldErrors(parsed.error),
    );
  }

  const result = await listConversations(context.env.DB, parsed.data);
  return context.json<ApiData<PaginatedConversations>>({ data: result });
});

inboxRoutes.get("/conversations/:id/messages", async (context) => {
  const conversationId = context.req.param("id");

  if (!uuidSchema.test(conversationId)) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "Invalid conversation ID.",
    );
  }

  const parsed = messageListQuerySchema.safeParse(context.req.query());

  if (!parsed.success) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "Invalid message query.",
      getZodFieldErrors(parsed.error),
    );
  }

  try {
    await getConversationById(context.env.DB, conversationId);
  } catch {
    return errorResponse(
      context,
      404,
      "INBOX_CONVERSATION_NOT_FOUND",
      "The conversation was not found.",
    );
  }

  const result = await listMessages(
    context.env.DB,
    conversationId,
    parsed.data,
  );
  return context.json<ApiData<PaginatedMessages>>({ data: result });
});

// --- Send Message ---

inboxRoutes.post("/conversations/:id/messages", async (context) => {
  const conversationId = context.req.param("id");

  if (!uuidSchema.test(conversationId)) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "Invalid conversation ID.",
    );
  }

  let contactId: string;
  try {
    contactId = await getContactIdByConversation(
      context.env.DB,
      conversationId,
    );
  } catch {
    return errorResponse(
      context,
      404,
      "INBOX_CONVERSATION_NOT_FOUND",
      "The conversation was not found.",
    );
  }

  const body = await readJsonBody(context.req.raw);
  if (!body.ok) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "The request must contain valid JSON.",
    );
  }

  const parsed = sendInboxMessageSchema.safeParse(body.value);
  if (!parsed.success) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "Invalid message input.",
      getZodFieldErrors(parsed.error),
    );
  }

  const { text, attachmentIds, clientMessageId } = parsed.data;

  if (!text && attachmentIds.length === 0) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "Message must contain text or at least one attachment.",
    );
  }

  const msgId = clientMessageId ?? crypto.randomUUID();

  // Idempotency: if clientMessageId was already sent, return existing result
  const existingMsg = clientMessageId
    ? await findMessageByClientId(context.env.DB, clientMessageId)
    : null;

  if (existingMsg) {
    return context.json<ApiData<SendResult>>({
      data: {
        messageId: existingMsg.id,
        clientMessageId: existingMsg.clientMessageId,
        status: existingMsg.status as SendResult["status"],
      },
    });
  }

  // Resolve the contact phone from the conversation, not from a hardcoded value
  const contact = await findContactById(context.env.DB, contactId);

  const pendingMsg = await insertMessage(context.env.DB, {
    conversationId,
    direction: "outbound",
    type: attachmentIds.length > 0 ? resolveMediaType(attachmentIds) : "text",
    text: text ?? null,
    clientMessageId: msgId,
    status: "pending",
  });

  try {
    const webhookUrl = context.env.N8N_WEBHOOK_URL;
    const secret = context.env.N8N_WEBHOOK_SECRET;

    if (!webhookUrl || !secret) {
      throw new N8nSendError("n8n webhook URL or secret not configured.");
    }

    const payload = buildOutboundPayload({
      clientMessageId: msgId,
      phoneE164: contact.phoneE164,
      type: pendingMsg.type,
      text: text ?? undefined,
      attachmentIds,
    });

    const result = await sendToN8n(webhookUrl, secret, payload);

    await setProviderMessageId(
      context.env.DB,
      pendingMsg.id,
      result.providerMessageId,
      "sent",
    );

    return context.json<ApiData<SendResult>>({
      data: {
        messageId: pendingMsg.id,
        clientMessageId: msgId,
        status: "sent",
      },
    });
  } catch (error) {
    // Update the pending message by its own ID, not by providerMessageId
    await updateMessageStatusById(
      context.env.DB,
      pendingMsg.id,
      "failed",
      null,
      error instanceof Error ? error.message : "Send failed",
    );

    return errorResponse(
      context,
      502,
      "INBOX_SEND_FAILED",
      error instanceof Error ? error.message : "Failed to send message.",
    );
  }
});

// --- Mark Read ---

inboxRoutes.post("/conversations/:id/read", async (context) => {
  const conversationId = context.req.param("id");

  if (!uuidSchema.test(conversationId)) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "Invalid conversation ID.",
    );
  }

  try {
    await getConversationById(context.env.DB, conversationId);
  } catch {
    return errorResponse(
      context,
      404,
      "INBOX_CONVERSATION_NOT_FOUND",
      "The conversation was not found.",
    );
  }

  await clearUnread(context.env.DB, conversationId);
  return context.body(null, 204);
});

// --- Media Upload ---

inboxRoutes.post("/media", async (context) => {
  const contentType = context.req.header("Content-Type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "Media upload requires multipart/form-data.",
    );
  }

  let formData: FormData;
  try {
    formData = await context.req.formData();
  } catch {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "Failed to parse multipart form data.",
    );
  }

  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "A 'file' field is required.",
    );
  }

  const mimeType = file.type || "application/octet-stream";

  if (!isAllowedMimeType(mimeType)) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "This file type is not supported.",
    );
  }

  if (!isUnderSizeLimit(file.size)) {
    return errorResponse(
      context,
      400,
      "INBOX_MEDIA_TOO_LARGE",
      "File must be under 25 MB.",
    );
  }

  const messageId =
    (formData.get("messageId") as string | null) || crypto.randomUUID();
  const r2Key = buildR2Key(messageId, file.name);

  const { key, size } = await uploadToR2(
    context.env.INBOX_MEDIA,
    r2Key,
    file.stream(),
    mimeType,
  );

  const attachment = await insertAttachment(context.env.DB, {
    messageId,
    r2Key: key,
    mimeType,
    filename: file.name,
    byteSize: size,
  });

  return context.json<ApiData<{ attachment: typeof attachment }>>(
    { data: { attachment } },
    201,
  );
});

// --- Media Download ---

inboxRoutes.get("/media/:id", async (context) => {
  const attachmentId = context.req.param("id");

  if (!uuidSchema.test(attachmentId)) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "Invalid attachment ID.",
    );
  }

  const attachment = await getAttachmentById(context.env.DB, attachmentId);

  if (!attachment) {
    return errorResponse(
      context,
      404,
      "INBOX_ATTACHMENT_NOT_FOUND",
      "The attachment was not found.",
    );
  }

  const object = await context.env.INBOX_MEDIA.get(attachment.r2Key);

  if (!object) {
    return errorResponse(
      context,
      404,
      "INBOX_ATTACHMENT_NOT_FOUND",
      "The attachment file was not found in storage.",
    );
  }

  // Sanitize filename for Content-Disposition header
  const safeFilename = attachment.filename.replace(/[^a-zA-Z0-9._-]/g, "_");

  return new Response(object.body, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
    },
  });
});

// --- Helpers ---

function resolveMediaType(attachmentIds: string[]): string {
  // Default to text; the actual type is determined by the attachment MIME
  return attachmentIds.length > 0 ? "document" : "text";
}
