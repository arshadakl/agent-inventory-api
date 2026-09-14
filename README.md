# Real Estate Inventory Dashboard

An internal real-estate inventory dashboard built as a single Cloudflare Worker application. The Worker serves both the React SPA and Hono API and uses Cloudflare D1 for persistence.

The implementation contract and delivery phases are documented in [PLAN.md](./PLAN.md).

The n8n action endpoint is documented in [N8N_API.md](./N8N_API.md).

## Prerequisites

- Node.js 22 or newer
- A Cloudflare account for remote D1 and deployment work

## Local development

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The placeholder D1 database ID in `wrangler.jsonc` supports foundation work only. Replace it with the ID returned when the real Cloudflare D1 database is created before remote migration or deployment.

## Initial user provisioning

There is no public registration endpoint. Apply the migration and create the first user from the terminal instead.

For the persistent local D1 database:

```bash
npm run db:migrate:local
npm run user:create -- --local --email owner@example.com
```

For the configured remote D1 database:

```bash
npm run db:migrate:remote
npm run user:create -- --remote --email owner@example.com
```

The command collects and confirms the password through masked prompts; passwords are never accepted as command-line arguments. Remote provisioning also requires typing the normalized email as an explicit confirmation. Before using `--remote`, replace the placeholder `database_id` in `wrangler.jsonc` with the real D1 database ID and authenticate Wrangler with Cloudflare.

## API

All API routes are served by the same Worker as the SPA. Requests use same-origin `/api/...` URLs and require a server-side session unless marked public.

```text
POST   /api/auth/login             public
GET    /api/auth/me                authenticated
POST   /api/auth/logout            authenticated

GET    /api/dashboard/stats        authenticated

GET    /api/properties             authenticated
POST   /api/properties             authenticated
GET    /api/properties/:id         authenticated
PATCH  /api/properties/:id         authenticated
DELETE /api/properties/:id         authenticated

GET    /api/users                  authenticated
POST   /api/users                  authenticated
DELETE /api/users/:id              authenticated

GET    /api/api-keys               authenticated
POST   /api/api-keys               authenticated
DELETE /api/api-keys/:id           authenticated

POST   /api/v1/actions/execute     API key required
```

Property listing supports `q`, `listingType`, `status`, `propertyType`, `page`, and `pageSize` query parameters. Passwords use PBKDF2-HMAC-SHA256, while D1 stores only password hashes and SHA-256 session-token hashes. Browser sessions use an HttpOnly, SameSite=Lax cookie.

There is no public registration endpoint. The responsive application supports login, dashboard inventory counts, property CRUD, user management, and logout.

## n8n integration

Create a named key from **API keys** in the dashboard and copy the secret when it is shown. The complete secret is never displayed again; create a replacement key if it is lost. n8n uses the key as a Bearer token and can access only the read-only action endpoint.

Configure an n8n **HTTP Request** node as follows:

- Method: `POST`
- URL: `https://real-estate-inventory.time-fade.workers.dev/api/v1/actions/execute`
- Authentication: Header auth, `Authorization: Bearer <your-api-key>`
- Send body as JSON

Example search for a furnished 2-bedroom Dubai Marina rental under AED 90,000 annually:

```json
{
  "action": "search_properties",
  "input": {
    "location": "Dubai Marina",
    "listingType": "rent",
    "furnished": true,
    "bedrooms": 2,
    "maxPrice": 90000
  }
}
```

Supported actions are `search_properties`, `get_property`, `check_availability`, and `similar_properties`. Prices are AED; rent prices represent annual rent. `search_properties` returns available listings by default and accepts `q`, `location`, `listingType`, `propertyType`, `furnished`, `bedrooms`, `bathrooms`, `minPrice`, `maxPrice`, `status`, and `limit` (1–20). The other actions require `propertyId`; `similar_properties` also accepts `limit`.

For production, add a Cloudflare rate-limit rule matching `/api/v1/actions/*`: 60 requests per minute per source IP, blocking for 60 seconds. Revoke a key immediately if it is exposed.
