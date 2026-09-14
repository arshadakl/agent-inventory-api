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
