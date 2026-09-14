# Real Estate Inventory Dashboard — Agent Implementation Plan

## Purpose and delivery boundary

Build an internal real-estate inventory dashboard as one repository and **one Cloudflare Worker deployment**. The Worker serves the React/Vite static SPA and the Hono API under the same domain, with Cloudflare D1 as its database.

The MVP includes login, dashboard metrics, property CRUD with searchable/filterable pagination, and user list/create/delete. All authenticated users have identical permissions.

Do not build separate frontend/API deployments, Cloudflare Pages, public signup, roles/RBAC, password resets, property images, R2, maps, leads, customers, owners, imports/exports, analytics charts, automation, payments, audit logs, or other v2 features.

## Required architecture and stack

Use React, TypeScript, Vite, React Router, Tailwind CSS, shadcn/ui, TanStack Query, React Hook Form, and Zod on the client. Use TypeScript, Cloudflare Workers, Hono, Zod, D1, Wrangler, and `@cloudflare/vite-plugin` on the server. Use Vitest with `@cloudflare/vitest-plugin` for tests.

Use a single-project structure with `src/` for the SPA, `worker/` for Worker routes/services/middleware, `shared/` for truly shared Zod schemas and TypeScript API types, `migrations/` for D1 SQL, and `scripts/` for provisioning helpers.

- Serve SPA routes (`/login`, `/dashboard`, `/properties`, `/properties/new`, `/properties/:id/edit`, `/users`) through static-assets SPA fallback.
- Route `/api/*` to the Worker before static assets.
- Use relative client requests only, such as `fetch("/api/properties")`; never configure a separate API origin.
- Configure `vite.config.ts` with React and the Cloudflare Vite plugin.
- Configure `wrangler.jsonc` with `worker/index.ts`, D1 binding `DB`, migration directory `migrations`, and static-assets SPA fallback. Do not hard-code a Pages deployment or an unrelated static output deployment.
- `npm run deploy` must build and deploy both the SPA and Worker.

Required scripts: `dev`, `build`, `preview`, `deploy`, `db:migrate:local`, `db:migrate:remote`, `typecheck`, `lint`, `test`, `test:watch`, and `user:create`.

## Engineering standards

Treat this document as an implementation contract. Optimize for correctness, clarity, and maintainability rather than cleverness or speed of code generation.

### Code quality

- Enable strict TypeScript. Do not introduce `any`, non-null assertions, or unsafe type casts to bypass the compiler; narrow unknown values at system boundaries.
- Keep functions small and cohesive. Prefer descriptive names, guard clauses, immutable values, and explicit return types on exported functions.
- Keep React components focused on rendering and user interaction. Put server-state orchestration in feature hooks, request concerns in the API client, validation in shared schemas, and business/database logic in Worker services.
- Keep Hono route handlers thin: parse input, call a service, and translate the result into an HTTP response. Services must not depend on Hono request/response objects.
- Centralize DB-to-domain mapping, API error creation, query keys, shared enums, and validation. Do not duplicate domain rules or scatter magic strings and status codes.
- Prefer composition over inheritance and direct code over speculative abstractions. Extract shared code only when it represents a stable domain concept or removes meaningful duplication.
- Comments must explain intent, invariants, or tradeoffs—not restate the code. Remove dead code and do not commit commented-out implementations.
- Keep modules easy to scan: imports, local types/constants, exported implementation, then private helpers. Use consistent formatting enforced by repository tooling.

### Boundaries and failure handling

- Treat HTTP input, cookies, URL parameters, D1 records, and environment bindings as untrusted boundaries. Validate or map them before use.
- Model expected failures explicitly and return safe, actionable errors. Unexpected failures are logged with useful context on the server and returned as `INTERNAL_ERROR` without sensitive details.
- Do not silently swallow errors. Avoid catch-all fallbacks that make corrupt or invalid data look successful.
- Keep side effects at the edges. Favor pure validation, mapping, filtering, and formatting helpers that can be tested without Workers bindings or React rendering.
- Make mutations idempotent where practical, invalidate only the affected query keys, and prevent stale UI after create/update/delete operations.

### Frontend quality and accessibility

- Use Tailwind CSS utilities and shadcn/ui primitives as the application design system. Extend shared semantic tokens and reusable UI components instead of introducing page-specific CSS conventions or another component library.
- Use semantic HTML, associated labels, keyboard-operable controls, visible focus states, and accessible dialog titles/descriptions. Icon-only actions require accessible names.
- Do not use color as the only status indicator. Maintain readable contrast and usable layouts at mobile, tablet, and desktop widths.
- Avoid duplicated form state. React Hook Form owns form values; Zod owns validation; server errors are mapped deliberately to fields or a form-level message.
- Preserve filters and pagination in the URL. Reset the page when a filter changes and avoid race-prone manual request state when TanStack Query can own it.

### Testing and review discipline

- Test public behavior, authorization boundaries, domain rules, and failure cases rather than private implementation details.
- Every bug fix must include a regression test when the failure can be reproduced deterministically.
- Keep tests deterministic: control time/data explicitly, isolate D1 state, and do not depend on test order or external services.
- Before every phase commit, review the staged diff for secrets, accidental generated files, debug output, scope creep, and unrelated edits; then run the checks relevant to that phase.
- A phase is complete only when its implementation, tests, error/loading states, documentation impact, and acceptance criteria are satisfied. Never commit known failing checks.

## Data model and validation

Create `migrations/0001_initial.sql` containing:

- `users`: UUID text primary key, case-insensitive unique email, password hash, and Unix-second created/updated timestamps.
- `sessions`: UUID text primary key, `user_id` foreign key with `ON DELETE CASCADE`, unique token hash, expiry, and creation timestamp; index user ID and expiry.
- `properties`: UUID text primary key; title; property type (`apartment`, `villa`, `house`, `land`, `commercial`, `other`); listing type (`sale`, `rent`); furnished boolean stored as `0/1`; location; non-negative integer price; optional non-negative integer area/beds/baths; status (`available`, `sold`, `rented`); optional description; timestamps. Index creation date, listing type, status, and property type.

Expose camelCase API/domain fields, not D1 snake_case fields. Map database records at the Worker boundary.

Use one shared Zod property schema on both client and Worker. Validate again in the Worker: title and location 2–120 characters; required property/listing/status enums and furnished boolean; non-negative integer price; nullable optional non-negative integer area, bedrooms, and bathrooms; optional description capped at about 1000 characters. Normalize every email via `trim().toLowerCase()`.

## API contract

All API errors must use `{ "error": { "code", "message", "fields"? } }`; do not expose D1 details or stack traces. Use status codes: 200 success, 201 creation, 204 deletion/logout, 400 malformed request, 401 unauthenticated, 404 missing resource, 409 conflicts, and 500 unexpected failures.

| Area       | Endpoint and behavior                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Auth       | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`                                                                 |
| Users      | `GET /api/users`, `POST /api/users`, `DELETE /api/users/:id`                                                                        |
| Properties | `GET /api/properties`, `GET /api/properties/:id`, `POST /api/properties`, `PATCH /api/properties/:id`, `DELETE /api/properties/:id` |
| Dashboard  | `GET /api/dashboard/stats`                                                                                                          |

List properties with `q`, `listingType`, `status`, `propertyType`, `page`, and `pageSize`; default to page 1 and 20 items, cap page size at 100, search title/location with parameterized `LIKE`, combine filters, and sort newest first. Return items plus `{ page, pageSize, total, totalPages }`.

Return dashboard counts in one conditional-aggregate query: total, available, forSale, forRent, sold, and rented.

Do not create a registration endpoint. `scripts/create-initial-user.ts` must provision the initial account using the same password hashing implementation as the user API, with documented local and remote D1 use.

## Security rules

- Use server-side sessions, not JWTs or localStorage auth.
- Use PBKDF2-HMAC-SHA256 through Workers Web Crypto, a unique cryptographic salt per password, a bounded accepted password length, and a versioned/parameterized hash format. Start with 600,000 iterations and verify suitable Workers runtime performance.
- Generate at least 32 random bytes for session tokens. Store only their SHA-256 hashes in D1; send the raw token only in an HttpOnly cookie named `session`.
- The cookie uses `Path=/`, `SameSite=Lax`, roughly seven-day `Max-Age`, and `Secure` in production. On requests, hash the cookie token, look up the unexpired session, and authenticate through its user. Delete the active session and clear the cookie on logout; opportunistically clean expired sessions on login/session creation.
- Return the identical `Invalid email or password` response for unknown email and invalid password.
- Worker middleware protects every API route except login. Frontend route protection is only UX.
- Reject attempts to delete the currently authenticated user with `409 CANNOT_DELETE_SELF`; deleting another user cascades their sessions.
- Check `Origin` against the request host for `POST`, `PATCH`, `PUT`, and `DELETE` requests.
- Use prepared D1 statements and bindings for every user-provided SQL value. Only construct known, trusted SQL fragments dynamically.

## Frontend behavior

Implement a shared authenticated dashboard layout with desktop sidebar, mobile drawer, current email, and logout. On startup, fetch `/api/auth/me`; show a full-page loading state, redirect unauthenticated users to `/login`, and redirect authenticated users away from `/login` to `/dashboard`.

Use a single API client wrapper for JSON, credentials, parsing, consistent errors, and 401 handling. Keep server state in TanStack Query with predictable keys. Invalidate properties/dashboard after property mutations and users after user mutations.

- Login: email/password only; successful login navigates to `/dashboard`.
- Dashboard: simple cards for total properties, available, for sale, and for rent (with sold/rented optional if space permits).
- Inventory: desktop table, functional mobile cards or horizontal table scrolling, 300 ms debounced search, listing/status/type filters stored in URL search params, pagination, and delete confirmation.
- Property create/edit: reuse one form component; no images, maps, owner/agent details, commissions, documents, amenities, video, or coordinates.
- Users: list emails and creation dates; add-user dialog includes email/password/confirm password, while only email/password reach the API; permit deleting other users only.
- Handle loading, success, empty, filtered-empty, error, form-validation, and concise toast states for all asynchronous screens.

Use a clean responsive internal-dashboard visual style: neutral backgrounds, subtle borders, strong type, clear tables, simple sidebar, and practical spacing. Avoid marketing-page styling, illustration, excessive gradients, glassmorphism, and gratuitous animations.

## Implementation phases and local commits

Agents must work in this order. After each independently verified phase, create a focused **local** commit; do not push to GitHub.

1. Foundation: initialize React/TypeScript/Vite/Worker/D1/Hono/Tailwind/shadcn/Router/Query/Zod/form/testing configuration; verify development server and build. Commit: `feat: initialize cloudflare react application`.
2. Database: add the initial D1 migration, tables, constraints, and indexes; apply locally. Commit: `feat: add d1 database schema and migrations`.
3. Authentication backend: password helpers, session/cookie functions, origin/auth middleware, login/logout/me, and tests. Commit: `feat: implement session authentication`.
4. Initial-user provisioning: implement and document local/remote bootstrap CLI use. Commit: `feat: add initial user provisioning`.
5. Authentication frontend: login page, auth query, protected routes, shell, redirects, and logout. Commit: `feat: add authenticated dashboard shell`.
6. Properties API: CRUD, list filtering/pagination, mappings, validation, and Worker/D1 tests. Commit: `feat: add property inventory api`.
7. Inventory listing: table/cards, URL filters, search debounce, pagination, states, and delete confirmation. Commit: `feat: add inventory listing`.
8. Property forms: reusable create/edit form and routes. Commit: `feat: add property create and edit flows`.
9. Users: protected list/create/delete API and UI, including self-delete protection. Commit: `feat: add user management`.
10. Dashboard: statistics endpoint and summary cards. Commit: `feat: add inventory dashboard statistics`.
11. UX polish: responsive layout, loading states, toasts, errors, validation messaging, dialogs, and mobile sidebar. Commit: `feat: polish dashboard user experience`.
12. Hardening: run all quality checks and correct defects. Use focused `fix: ...` commits for discovered bugs.

## Commit policy

Use Conventional Commit subjects in lowercase, with focused changes only:

- `feat: ...` for user-visible functionality.
- `fix: ...` for defect corrections.
- `chore: ...` for tooling, configuration, and maintenance.
- `test: ...`, `docs: ...`, or `refactor: ...` where those accurately describe the isolated change.

Never use vague commit subjects such as `update code`, `changes`, or `final`. Do not amend, reset, force-push, or push unless the user explicitly requests it.

## Verification and acceptance

Before final hardening, run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Test valid and invalid login behavior (including indistinguishable unknown-email/password failures), session enforcement and logout invalidation, user creation/duplicate handling/no hash exposure/self-delete prevention, property CRUD and validation, 404 after deletion, individual and combined listing filters with pagination, and dashboard counts after mutations.

Perform this manual acceptance flow before declaring the MVP complete:

1. Create the D1 database, apply migrations, and provision the initial user.
2. Run the application locally and log in.
3. Confirm dashboard loading, create a second user, and list users.
4. Add an apartment and villa; search, filter, paginate, edit, and delete inventory.
5. Confirm dashboard statistics update, delete the second user, and log out.
6. Confirm a protected API responds with 401 after logout.
7. Build and deploy with `npm run deploy`; verify the production result is one Worker application serving both SPA and API.

The MVP is done only when authenticated users can complete login → dashboard → inventory management → user management → logout using the one Worker + D1 deployment.
