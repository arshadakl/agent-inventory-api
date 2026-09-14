# Real Estate Inventory Dashboard

An internal real-estate inventory dashboard built as a single Cloudflare Worker application. The Worker serves both the React SPA and Hono API and uses Cloudflare D1 for persistence.

The implementation contract and delivery phases are documented in [PLAN.md](./PLAN.md).

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

## Authentication API

The Worker implements server-side session authentication:

```text
POST /api/auth/login   public
GET  /api/auth/me      authenticated
POST /api/auth/logout  authenticated
```

All other `/api/*` routes require an unexpired session. Passwords use PBKDF2-HMAC-SHA256, while D1 stores only password hashes and SHA-256 session-token hashes. Browser sessions use an HttpOnly, SameSite=Lax cookie.

The login interface is delivered in the next implementation phase.
