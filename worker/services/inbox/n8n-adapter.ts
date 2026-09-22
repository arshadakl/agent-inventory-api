import type { N8nOutboundPayload } from "@shared/schemas/inbox";

export class N8nSendError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "N8nSendError";
  }
}

export async function sendToN8n(
  webhookUrl: string,
  secret: string,
  payload: N8nOutboundPayload,
): Promise<{ providerMessageId: string }> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new N8nSendError(
      `n8n webhook returned ${response.status}: ${body}`,
      response.status,
    );
  }

  const result = (await response.json()) as {
    providerMessageId?: string;
  };

  if (!result.providerMessageId) {
    throw new N8nSendError("n8n response missing providerMessageId.");
  }

  return { providerMessageId: result.providerMessageId };
}

export function buildOutboundPayload(input: {
  clientMessageId: string;
  phoneE164: string;
  type: string;
  text: string | undefined;
  attachmentIds: string[];
}): N8nOutboundPayload {
  return {
    requestId: input.clientMessageId,
    channel: "whatsapp",
    to: { phoneE164: input.phoneE164 },
    message: {
      type: input.type as N8nOutboundPayload["message"]["type"],
      text: input.text,
      attachmentIds: input.attachmentIds,
    },
    callback: {
      eventEndpoint: "/api/v1/inbox/events",
    },
  };
}
