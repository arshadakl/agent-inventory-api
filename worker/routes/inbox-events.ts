import { inboxEventSchema } from "@shared/schemas/inbox";
import type { ApiData } from "@shared/types/api";
import type { EventProcessResult } from "@shared/types/inbox";
import { Hono } from "hono";

import type { WorkerEnvironment } from "../env";
import { readJsonBody } from "../lib/request";
import { errorResponse, getZodFieldErrors } from "../lib/response";
import { processInboxEvent } from "../services/inbox/events.service";
import {
  uploadToR2,
  isAllowedMimeType,
  isUnderSizeLimit,
  buildR2Key,
} from "../services/inbox/media.service";
import {
  insertAttachment,
  getAttachmentById,
} from "../services/inbox/messages.service";

const uuidSchema =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const inboxEventRoutes = new Hono<WorkerEnvironment>();

inboxEventRoutes.post("/events", async (context) => {
  const body = await readJsonBody(context.req.raw);

  if (!body.ok) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "The request must contain valid JSON.",
    );
  }

  const parsed = inboxEventSchema.safeParse(body.value);

  if (!parsed.success) {
    return errorResponse(
      context,
      400,
      "INBOX_INVALID_EVENT",
      "Invalid inbox event payload.",
      getZodFieldErrors(parsed.error),
    );
  }

  try {
    const result = await processInboxEvent(context.env.DB, parsed.data);
    return context.json<ApiData<EventProcessResult>>({ data: result });
  } catch (error) {
    console.error("Failed to process inbox event", error);
    return errorResponse(
      context,
      500,
      "INTERNAL_ERROR",
      "Failed to process the inbox event.",
    );
  }
});

inboxEventRoutes.post("/media", async (context) => {
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
  const messageId = formData.get("messageId");

  if (!file || !(file instanceof File)) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "A 'file' field is required.",
    );
  }

  if (
    !messageId ||
    typeof messageId !== "string" ||
    !uuidSchema.test(messageId)
  ) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "A valid 'messageId' UUID is required.",
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

inboxEventRoutes.get("/media/:id", async (context) => {
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

  const safeFilename = attachment.filename.replace(/[^a-zA-Z0-9._-]/g, "_");

  return new Response(object.body, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
    },
  });
});
