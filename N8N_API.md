# n8n Inventory API

This guide explains how to connect n8n to the read-only real-estate inventory API.

## 1. Create an API key

1. Sign in to the dashboard.
2. Open **API keys** from the sidebar.
3. Select **Create API key**, enter a descriptive name such as `n8n production`, and copy the secret.

The complete key is shown once only. Store it in n8n credentials, not directly in a workflow node. Revoke and replace a key if it is lost or exposed.

## 2. Configure n8n

Create an **HTTP Request** node with:

| Setting           | Value                                                                        |
| ----------------- | ---------------------------------------------------------------------------- |
| Method            | `POST`                                                                       |
| URL               | `https://real-estate-inventory.time-fade.workers.dev/api/v1/actions/execute` |
| Authentication    | Header auth                                                                  |
| Header name       | `Authorization`                                                              |
| Header value      | `Bearer <your-api-key>`                                                      |
| Body content type | JSON                                                                         |

All requests use the same endpoint. Select the operation through the JSON `action` field.

```json
{
  "action": "search_properties",
  "input": {}
}
```

API keys are read-only: they cannot create, update, or delete properties, users, or dashboard keys.

## WhatsApp automation flow

For a WhatsApp workflow, n8n remains the orchestrator:

```text
WhatsApp Cloud API → n8n incoming router → AI intent router
→ Inventory API → n8n response formatter → WhatsApp Cloud API
```

Have the AI intent router return one strict JSON object containing an action and input. Validate that object in n8n before calling the Worker.

```json
{
  "action": "search_properties",
  "input": {
    "location": "Dubai Marina",
    "listingType": "rent",
    "bedrooms": 2,
    "furnished": true,
    "maxPrice": 90000
  }
}
```

Use the Worker response as structured data, then let a separate n8n node create the customer-facing WhatsApp message. Keep WhatsApp webhook verification, message deduplication, AI routing, outbound messaging, and workflow logging in n8n.

MCP is not needed for this flow. The REST action endpoint is the intended n8n integration interface.

## 3. Actions

### `search_properties`

Searches properties. Results default to listings with `status: "available"`.

```json
{
  "action": "search_properties",
  "input": {
    "location": "Dubai Marina",
    "listingType": "rent",
    "furnished": true,
    "bedrooms": 2,
    "maxPrice": 90000,
    "limit": 5
  }
}
```

| Input                    | Type                             | Notes                                                            |
| ------------------------ | -------------------------------- | ---------------------------------------------------------------- |
| `q`                      | string                           | Flexible title or location search.                               |
| `location`               | string                           | Case-insensitive partial location match.                         |
| `listingType`            | `sale` or `rent`                 | Optional.                                                        |
| `propertyType`           | property type                    | `apartment`, `villa`, `house`, `land`, `commercial`, or `other`. |
| `furnished`              | boolean                          | Optional.                                                        |
| `bedrooms` / `bathrooms` | non-negative integer             | Exact match.                                                     |
| `minPrice` / `maxPrice`  | non-negative integer             | Inclusive AED price range.                                       |
| `status`                 | `available`, `sold`, or `rented` | Defaults to `available`.                                         |
| `limit`                  | integer                          | Defaults to 5; range 1–20.                                       |

### `get_property`

Returns the complete property record for a known property ID.

```json
{
  "action": "get_property",
  "input": {
    "propertyId": "00000000-0000-4000-8000-000000000000"
  }
}
```

### `check_availability`

Returns a property status and a simplified `available` boolean.

```json
{
  "action": "check_availability",
  "input": {
    "propertyId": "00000000-0000-4000-8000-000000000000"
  }
}
```

### `similar_properties`

Returns available alternatives with the same listing type and property type, excluding the source property and limited to a ±20% price band.

```json
{
  "action": "similar_properties",
  "input": {
    "propertyId": "00000000-0000-4000-8000-000000000000",
    "limit": 5
  }
}
```

## 4. Responses

Successful responses use this envelope:

```json
{
  "data": {
    "action": "search_properties",
    "result": {
      "properties": [],
      "priceContext": {
        "currency": "AED",
        "rentalPeriod": "annual"
      }
    }
  }
}
```

All prices are AED. Rental prices represent annual rent.

`get_property` returns `{ "property", "priceContext" }`. `check_availability` returns `{ "propertyId", "status", "available", "priceContext" }`.

Errors use the safe shared envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid integration action."
  }
}
```

| Status | Meaning                                                    |
| ------ | ---------------------------------------------------------- |
| `400`  | Invalid JSON, unsupported action, or invalid action input. |
| `401`  | Missing, malformed, unknown, or revoked API key.           |
| `404`  | Requested property does not exist.                         |
| `500`  | Unexpected server error; no database details are returned. |

For `400`, ask the AI router to retry with a supported action and valid input. For `401`, stop the workflow and replace or restore the n8n credential. For `404`, tell the customer that the requested listing is unavailable and optionally run `similar_properties` when a property ID is known. For `500`, use the n8n error handler and offer human follow-up instead of exposing internal errors.

## Current scope

This API currently supports inventory lookup only. The following WhatsApp workflow features are not available yet and must not be called as API actions:

- Lead creation
- Conversation memory or message persistence
- Viewing scheduling
- Human handoff state or assignment

These require separate Worker actions and D1 data models before they can be integrated into n8n.

## 5. Security and operations

- Use an n8n credential for the API key; do not paste it into workflow JSON or source control.
- Revoke a key from the dashboard immediately if it is exposed.
- Configure a Cloudflare rate-limit rule for `/api/v1/actions/*`: 60 requests per minute per source IP, blocking for 60 seconds.
- The endpoint is intended for server-to-server n8n calls and does not require a browser `Origin` header.
