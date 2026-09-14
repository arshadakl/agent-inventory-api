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

## 5. Security and operations

- Use an n8n credential for the API key; do not paste it into workflow JSON or source control.
- Revoke a key from the dashboard immediately if it is exposed.
- Configure a Cloudflare rate-limit rule for `/api/v1/actions/*`: 60 requests per minute per source IP, blocking for 60 seconds.
- The endpoint is intended for server-to-server n8n calls and does not require a browser `Origin` header.
