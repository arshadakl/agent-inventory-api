# WhatsApp Inbox API Reference

Complete reference for all inbox endpoints used by n8n and the dashboard.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Error Format](#error-format)
3. [n8n → Worker Endpoints](#n8n--worker-endpoints)
   - [POST /api/v1/inbox/events](#post-apiv1inboxevents)
   - [POST /api/v1/inbox/media](#post-apiv1inboxmedia)
   - [GET /api/v1/inbox/media/:id](#get-apiv1inboxmediaid)
4. [Worker → n8n Outbound Contract](#worker--n8n-outbound-contract)
5. [Dashboard Endpoints](#dashboard-endpoints)
   - [GET /api/inbox/conversations](#get-apiinboxconversations)
   - [GET /api/inbox/conversations/:id/messages](#get-apiinboxconversationsidmessages)
   - [POST /api/inbox/conversations/:id/messages](#post-apiinboxconversationsidmessages)
   - [POST /api/inbox/conversations/:id/read](#post-apiinboxconversationsidread)
   - [POST /api/inbox/media](#post-apiinboxmedia-1)
   - [GET /api/inbox/media/:id](#get-apiinboxmediaid-1)
6. [Data Structures](#data-structures)
7. [Status Transitions](#status-transitions)
8. [Idempotency](#idempotency)
9. [Error Codes Reference](#error-codes-reference)

---

## Authentication

### n8n Integration (Bearer API Key)

All `/api/v1/inbox/*` endpoints require a Bearer token in the `Authorization` header.

```
Authorization: Bearer rei_live_abc123def456...
```

The API key must have the `inbox:write` scope. Create one from the dashboard:

```json
POST /api/api-keys
{
  "name": "n8n-inbox",
  "scopes": ["inbox:write", "inbox:media:read", "inbox:media:write"]
}
```

### Dashboard (Session Cookie)

All `/api/inbox/*` endpoints use the browser session cookie. No API key needed.

---

## Error Format

All errors follow a consistent envelope:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description.",
    "fields": {
      "fieldName": "Field-specific error message"
    }
  }
}
```

`fields` is optional and only present for validation errors.

---

## n8n → Worker Endpoints

### POST /api/v1/inbox/events

Receives inbound messages and delivery status updates from n8n. This is the primary ingestion endpoint.

**Headers:**

```
Authorization: Bearer <api-key>
Content-Type: application/json
```

#### Inbound Message Event

Sent when a WhatsApp message is received from a customer.

```json
{
  "eventId": "Evt-abc123",
  "eventType": "message.received",
  "provider": "whatsapp-cloud",
  "channel": "whatsapp",
  "occurredAt": "2026-09-21T08:00:00Z",
  "contact": {
    "phoneE164": "+919876543210",
    "displayName": "Ahmed Khan"
  },
  "message": {
    "providerMessageId": "wamid.HBgLMTIxNTAwMDAwMA==",
    "type": "text",
    "text": "Is this property available?",
    "caption": null,
    "attachmentIds": [],
    "replyToProviderMessageId": null,
    "providerTimestamp": "2026-09-21T07:59:58Z"
  }
}
```

**Field Reference — Inbound Message:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `eventId` | string | Yes | Unique event identifier from the provider. Used for deduplication. |
| `eventType` | `"message.received"` | Yes | Must be exactly `"message.received"`. |
| `provider` | string | Yes | Provider name (e.g., `"whatsapp-cloud"`, `"twilio"`). |
| `channel` | `"whatsapp"` | Yes | Communication channel. |
| `occurredAt` | ISO 8601 datetime | Yes | When the event occurred on the provider side. |
| `contact.phoneE164` | string | Yes | Sender phone in E.164 format (e.g., `"+919876543210"`). |
| `contact.displayName` | string \| null | No | Sender's display name if available. |
| `message.providerMessageId` | string | Yes | Provider's unique message ID (e.g., `"wamid.HBg..."`). |
| `message.type` | enum | Yes | One of: `"text"`, `"image"`, `"video"`, `"audio"`, `"document"`, `"sticker"`. |
| `message.text` | string \| null | No | Message body for text messages. |
| `message.caption` | string \| null | No | Caption for media messages. |
| `message.attachmentIds` | string[] | No | UUIDs of previously uploaded attachments (via `POST /api/v1/inbox/media`). Defaults to `[]`. |
| `message.replyToProviderMessageId` | string \| null | No | Provider message ID of the message being replied to. |
| `message.providerTimestamp` | ISO 8601 datetime | Yes | When the message was sent by the provider. |

#### Status Update Event

Sent when a message's delivery status changes (sent, delivered, read, failed).

```json
{
  "eventId": "Status-xyz789",
  "eventType": "message.status.updated",
  "provider": "whatsapp-cloud",
  "occurredAt": "2026-09-21T08:01:00Z",
  "message": {
    "providerMessageId": "wamid.HBgLMTIxNTAwMDAwMA==",
    "status": "delivered",
    "statusAt": "2026-09-21T08:01:00Z",
    "errorCode": null,
    "errorMessage": null
  }
}
```

**Field Reference — Status Update:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `eventId` | string | Yes | Unique event identifier. Used for deduplication. |
| `eventType` | `"message.status.updated"` | Yes | Must be exactly `"message.status.updated"`. |
| `provider` | string | Yes | Provider name. |
| `occurredAt` | ISO 8601 datetime | No | When the status change occurred. |
| `message.providerMessageId` | string | Yes | The provider message ID whose status changed. |
| `message.status` | enum | Yes | One of: `"sent"`, `"delivered"`, `"read"`, `"failed"`. |
| `message.statusAt` | ISO 8601 datetime | Yes | When the status transition occurred. |
| `message.errorCode` | string \| null | No | Provider error code if status is `"failed"`. |
| `message.errorMessage` | string \| null | No | Human-readable error if status is `"failed"`. |

**Response (200 OK):**

```json
{
  "data": {
    "eventId": "Evt-abc123",
    "duplicate": false
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `eventId` | string | The event ID that was processed. |
| `duplicate` | boolean | `true` if this event was already processed (idempotent). `false` if it's new. |

**Processing Logic:**

1. Worker checks `provider:eventId` for duplicates
2. If duplicate, returns `{ duplicate: true }` — no message created
3. If new, inserts the event record, then:
   - For `message.received`: upserts contact → upserts conversation → inserts message → increments unread count
   - For `message.status.updated`: finds message by `providerMessageId` → applies monotonic status transition
4. Returns `{ duplicate: false }`

---

### POST /api/v1/inbox/media

Uploads a media file to R2 storage. Used by n8n to store WhatsApp media (images, videos, documents) before creating the message event.

**Headers:**

```
Authorization: Bearer <api-key>
Content-Type: multipart/form-data
```

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | binary | Yes | The media file. Max 25 MB. |
| `messageId` | string (UUID) | Yes | The message ID this attachment belongs to. |

**Allowed MIME Types:**

| Category | Types |
|----------|-------|
| Image | `image/jpeg`, `image/png`, `image/webp`, `image/gif` |
| Video | `video/mp4`, `video/3gpp` |
| Audio | `audio/ogg`, `audio/mpeg`, `audio/aac`, `audio/mp4` |
| Document | `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `text/plain` |

**Response (201 Created):**

```json
{
  "data": {
    "attachment": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "messageId": "660e8400-e29b-41d4-a716-446655440001",
      "mimeType": "image/jpeg",
      "filename": "property-photo.jpg",
      "byteSize": 1048576,
      "width": null,
      "height": null,
      "durationMs": null
    }
  }
}
```

**Attachment Object Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique attachment ID. Reference this in `message.attachmentIds`. |
| `messageId` | UUID | The message this attachment belongs to. |
| `mimeType` | string | MIME type of the file. |
| `filename` | string | Original filename. |
| `byteSize` | integer | File size in bytes. |
| `width` | integer \| null | Image/video width in pixels (if available). |
| `height` | integer \| null | Image/video height in pixels (if available). |
| `durationMs` | integer \| null | Audio/video duration in milliseconds (if available). |

---

### GET /api/v1/inbox/media/:id

Downloads an attachment by its UUID. Used by n8n to fetch attachments before sending via WhatsApp provider.

**Headers:**

```
Authorization: Bearer <api-key>
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | The attachment ID returned by `POST /api/v1/inbox/media`. |

**Response (200 OK):**

Returns the raw file with appropriate headers:

```
Content-Type: image/jpeg
Content-Disposition: attachment; filename="property-photo.jpg"
```

**Error Responses:**

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Attachment ID is not a valid UUID. |
| 404 | `INBOX_ATTACHMENT_NOT_FOUND` | No attachment with this ID exists, or the file is missing from R2. |

---

## Worker → n8n Outbound Contract

When an agent sends a message from the dashboard, the Worker calls your n8n webhook.

### Webhook Payload

```
POST <your-n8n-webhook-url>
Authorization: Bearer <N8N_WEBHOOK_SECRET>
Content-Type: application/json
```

```json
{
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "channel": "whatsapp",
  "to": {
    "phoneE164": "+919876543210"
  },
  "message": {
    "type": "text",
    "text": "Hello! The property is available for viewing.",
    "attachmentIds": []
  },
  "callback": {
    "eventEndpoint": "/api/v1/inbox/events"
  }
}
```

**Payload Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `requestId` | UUID | Unique message ID. **n8n must use this as an idempotency key** — retrying the same `requestId` must not send a duplicate WhatsApp message. |
| `channel` | `"whatsapp"` | Communication channel. |
| `to.phoneE164` | string | Recipient phone in E.164 format. |
| `message.type` | enum | One of: `"text"`, `"image"`, `"video"`, `"audio"`, `"document"`, `"sticker"`. |
| `message.text` | string \| undefined | Message text. May be `undefined` for media-only messages. |
| `message.attachmentIds` | UUID[] | Attachment IDs. Fetch each via `GET /api/v1/inbox/media/:id`. |
| `callback.eventEndpoint` | string | The endpoint n8n should POST status updates back to. |

### Fetching Attachments

Before sending, n8n must download each attachment:

```
GET https://your-worker.com/api/v1/inbox/media/<attachment-id>
Authorization: Bearer <your-worker-api-key>
```

Then upload the file to the WhatsApp provider.

### n8n Response

n8n must return a JSON response containing the provider's message ID:

```json
{
  "providerMessageId": "wamid.HBgLMTIxNTAwMDAwMA=="
}
```

### Status Callbacks

After sending, n8n must send status updates back to the Worker as the message progresses through the provider:

```
POST https://your-worker.com/api/v1/inbox/events
Authorization: Bearer <worker-api-key>
Content-Type: application/json
```

**Sent status:**

```json
{
  "eventId": "status-sent-001",
  "eventType": "message.status.updated",
  "provider": "whatsapp-cloud",
  "message": {
    "providerMessageId": "wamid.HBgLMTIxNTAwMDAwMA==",
    "status": "sent",
    "statusAt": "2026-09-21T08:00:05Z"
  }
}
```

**Delivered status:**

```json
{
  "eventId": "status-delivered-001",
  "eventType": "message.status.updated",
  "provider": "whatsapp-cloud",
  "message": {
    "providerMessageId": "wamid.HBgLMTIxNTAwMDAwMA==",
    "status": "delivered",
    "statusAt": "2026-09-21T08:00:10Z"
  }
}
```

**Read status:**

```json
{
  "eventId": "status-read-001",
  "eventType": "message.status.updated",
  "provider": "whatsapp-cloud",
  "message": {
    "providerMessageId": "wamid.HBgLMTIxNTAwMDAwMA==",
    "status": "read",
    "statusAt": "2026-09-21T08:05:00Z"
  }
}
```

**Failed status:**

```json
{
  "eventId": "status-failed-001",
  "eventType": "message.status.updated",
  "provider": "whatsapp-cloud",
  "message": {
    "providerMessageId": "wamid.HBgLMTIxNTAwMDAwMA==",
    "status": "failed",
    "statusAt": "2026-09-21T08:00:03Z",
    "errorCode": "131026",
    "errorMessage": "Message undeliverable"
  }
}
```

---

## Dashboard Endpoints

These endpoints are used by the React dashboard (session auth). They follow the same data shapes as the n8n endpoints.

### GET /api/inbox/conversations

Lists conversations with search, filtering, and pagination.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | — | Search by phone number or display name. |
| `unreadOnly` | `"true"` \| `"false"` | `"false"` | Filter to only unread conversations. |
| `before` | UUID | — | Cursor: conversations before this conversation ID. |
| `after` | UUID | — | Cursor: conversations after this conversation ID. |
| `limit` | integer | `20` | Number of conversations (1–100). |

**Response (200 OK):**

```json
{
  "data": {
    "items": [
      {
        "id": "conv-uuid-1",
        "contactId": "contact-uuid-1",
        "channel": "whatsapp",
        "lastMessageAt": 1726915200,
        "lastMessagePreview": "Is this property available?",
        "unreadCount": 2,
        "createdAt": 1726900000,
        "updatedAt": 1726915200,
        "contact": {
          "id": "contact-uuid-1",
          "phoneE164": "+919876543210",
          "displayName": "Ahmed Khan",
          "avatarUrl": null
        }
      }
    ],
    "nextCursor": "conv-uuid-2",
    "hasMore": true
  }
}
```

---

### GET /api/inbox/conversations/:id/messages

Lists messages in a conversation with cursor pagination.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Conversation ID. |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `before` | UUID | — | Cursor: messages created before this message ID. |
| `after` | UUID | — | Cursor: messages created after this message ID. |
| `limit` | integer | `50` | Number of messages (1–100). |

**Response (200 OK):**

```json
{
  "data": {
    "items": [
      {
        "id": "msg-uuid-1",
        "conversationId": "conv-uuid-1",
        "direction": "inbound",
        "type": "text",
        "text": "Is this property available?",
        "caption": null,
        "providerMessageId": "wamid.HBgLMTIxNTAwMDAwMA==",
        "clientMessageId": null,
        "status": "delivered",
        "providerTimestamp": 1726915198,
        "errorCode": null,
        "errorMessage": null,
        "replyToProviderMessageId": null,
        "attachments": [],
        "createdAt": 1726915200,
        "updatedAt": 1726915200
      },
      {
        "id": "msg-uuid-2",
        "conversationId": "conv-uuid-1",
        "direction": "outbound",
        "type": "text",
        "text": "Yes, it is available!",
        "caption": null,
        "providerMessageId": "wamid.HBgLMTIxNTAwMDAwMQ==",
        "clientMessageId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "status": "sent",
        "providerTimestamp": 1726915205,
        "errorCode": null,
        "errorMessage": null,
        "replyToProviderMessageId": null,
        "attachments": [],
        "createdAt": 1726915205,
        "updatedAt": 1726915205
      }
    ],
    "nextCursor": null,
    "hasMore": false
  }
}
```

---

### POST /api/inbox/conversations/:id/messages

Sends a message from the dashboard agent to the customer via n8n.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Conversation ID. |

**Request Body:**

```json
{
  "text": "Hello! How can I help you?",
  "attachmentIds": [],
  "clientMessageId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | No | Message text. Max 4096 characters. At least `text` or one attachment is required. |
| `attachmentIds` | UUID[] | No | Attachment IDs (upload via `POST /api/inbox/media` first). Max 10. |
| `clientMessageId` | UUID | No | Client-generated UUID for idempotency. Retrying with the same ID returns the original result. |

**Response (200 OK):**

```json
{
  "data": {
    "messageId": "msg-uuid-new",
    "clientMessageId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "sent"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `messageId` | UUID | The created message's ID. |
| `clientMessageId` | UUID \| null | The client message ID (echoed back). |
| `status` | `"pending"` \| `"sent"` | `"pending"` if queued, `"sent"` if n8n acknowledged. |

**Error Responses:**

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Invalid input, missing text and attachments, or invalid conversation ID. |
| 404 | `INBOX_CONVERSATION_NOT_FOUND` | Conversation does not exist. |
| 502 | `INBOX_SEND_FAILED` | n8n rejected the request or timed out. |

---

### POST /api/inbox/conversations/:id/read

Marks all unread messages in a conversation as read.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Conversation ID. |

**Response:** `204 No Content`

---

### POST /api/inbox/media

Uploads a media file (dashboard version, session auth). Same behavior as the n8n endpoint.

**Request:** `multipart/form-data` with `file` field.

**Response:** `201 Created` with attachment object (same shape as n8n endpoint).

---

### GET /api/inbox/media/:id

Downloads an attachment (dashboard version, session auth). Same behavior as the n8n endpoint.

---

## Data Structures

### Contact

```typescript
{
  id: string;           // UUID
  phoneE164: string;    // E.164 phone, e.g. "+919876543210"
  displayName: string | null;
  avatarUrl: string | null;
}
```

### Conversation

```typescript
{
  id: string;              // UUID
  contactId: string;       // UUID → Contact
  channel: string;         // "whatsapp"
  lastMessageAt: number;   // Unix timestamp (seconds)
  lastMessagePreview: string | null;
  unreadCount: number;     // >= 0
  createdAt: number;       // Unix timestamp
  updatedAt: number;       // Unix timestamp
}
```

### ConversationListItem

Extends `Conversation` with:

```typescript
{
  contact: Contact;  // Nested contact object
}
```

### Message

```typescript
{
  id: string;                          // UUID
  conversationId: string;              // UUID → Conversation
  direction: "inbound" | "outbound";
  type: "text" | "image" | "video" | "audio" | "document" | "sticker";
  text: string | null;
  caption: string | null;
  providerMessageId: string | null;    // Provider's message ID
  clientMessageId: string | null;      // Client's idempotency ID
  status: MessageStatus;
  providerTimestamp: number | null;    // Unix timestamp
  errorCode: string | null;
  errorMessage: string | null;
  replyToProviderMessageId: string | null;
  attachments: MessageAttachment[];
  createdAt: number;                   // Unix timestamp
  updatedAt: number;                   // Unix timestamp
}
```

### MessageAttachment

```typescript
{
  id: string;          // UUID
  messageId: string;   // UUID → Message
  mimeType: string;    // MIME type
  filename: string;    // Original filename
  byteSize: number;    // File size in bytes
  width: number | null;
  height: number | null;
  durationMs: number | null;
}
```

### MessageStatus

```typescript
"pending" | "sent" | "delivered" | "read" | "failed" | "unknown"
```

### PaginatedConversations

```typescript
{
  items: ConversationListItem[];
  nextCursor: string | null;  // Conversation ID for next page
  hasMore: boolean;
}
```

### PaginatedMessages

```typescript
{
  items: Message[];
  nextCursor: string | null;  // Message ID for next page
  hasMore: boolean;
}
```

---

## Status Transitions

Status transitions are **monotonic** — a message can only move forward:

```
unknown → pending → sent → delivered → read
                                      ↓
                                   failed
```

| Current | Allowed Next |
|---------|-------------|
| `unknown` | `pending`, `sent`, `delivered`, `read`, `failed` |
| `pending` | `sent`, `delivered`, `read`, `failed` |
| `sent` | `delivered`, `read`, `failed` |
| `delivered` | `read`, `failed` |
| `read` | (terminal) |
| `failed` | (terminal) |

If n8n sends a status that would go backward (e.g., `delivered` → `sent`), the Worker ignores it and returns the current status.

---

## Idempotency

### Inbound Events

The Worker uses `provider:eventId` as the idempotency key. If the same `eventId` is sent twice:

- First request: processes normally, returns `{ duplicate: false }`
- Subsequent requests: returns `{ duplicate: true }`, no new message created

### Outbound Sends

The `clientMessageId` field is the idempotency key for dashboard sends:

- First request: creates message, sends to n8n, returns result
- Subsequent requests with same `clientMessageId`: returns existing message result without calling n8n

### n8n Outbound

The `requestId` field in the Worker → n8n payload is the idempotency key. n8n **must** treat `requestId` as deduplication — retrying the same request must not send a second WhatsApp message.

---

## Error Codes Reference

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid JSON, missing fields, or invalid field values. |
| 401 | `UNAUTHORIZED` | Missing, invalid, or revoked API key. |
| 403 | `INBOX_SCOPE_REQUIRED` | API key exists but lacks required inbox scopes. |
| 404 | `INBOX_CONVERSATION_NOT_FOUND` | Conversation does not exist. |
| 404 | `INBOX_MESSAGE_NOT_FOUND` | Message does not exist. |
| 404 | `INBOX_ATTACHMENT_NOT_FOUND` | Attachment does not exist or file is missing from R2. |
| 400 | `INBOX_INVALID_PHONE` | Phone number is not valid E.164. |
| 400 | `INBOX_MEDIA_TOO_LARGE` | File exceeds 25 MB or unsupported MIME type. |
| 400 | `INBOX_INVALID_EVENT` | Event payload does not match the expected schema. |
| 502 | `INBOX_SEND_FAILED` | n8n rejected the request, timed out, or returned an error. |
| 500 | `INTERNAL_ERROR` | Unexpected server error. |
