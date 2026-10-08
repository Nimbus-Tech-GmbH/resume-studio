# Local Dev

## Prereqs

- Node ≥ 20.19 (`.nvmrc` pins 20.19.0). `nvm use` if you use nvm.
- pnpm ≥ 9 (`corepack enable` will set it up automatically).
- The Keystone CMS from `nt-keystone-cms` running locally (only needed for authenticated mode).
- The `resume-auth-db` Postgres container running (image `postgres:15-bookworm`, host port `5434`). The auth-service writes to the `auth` schema in this DB — separate from Keystone's database.

## First-time setup

```sh
pnpm install
cp .env.example .env
pnpm generate
```

`pnpm generate` runs Prisma's code generator (`prisma generate`) to emit the Prisma Client in each workspace.

If the auth Postgres container doesn't exist yet, create it:

```sh
docker run -d --name resume-auth-db \
  -e POSTGRES_USER=admin -e POSTGRES_PASSWORD=dev-auth-pass \
  -e POSTGRES_DB=resume-auth -p 127.0.0.1:5434:5432 \
  postgres:15-bookworm
```

Edit `.env` if your Keystone/render/auth endpoints or credentials differ.

Create the Better Auth schema if it's missing:

```sh
docker exec -i resume-auth-db psql -U admin -d resume-auth
# CREATE SCHEMA IF NOT EXISTS auth; \q
```

Or apply Prisma migrations:

```sh
pnpm --filter @resume-studio/auth-service exec prisma migrate deploy
```

### Guest mode (no Keystone needed)

**Guest mode** works without Keystone running. No GraphQL calls are made.
You can create and import resumes locally, preview them via the render
service, and export as JSON/PDF. Data is session-only (lost on browser close).

To use guest mode, just start the dev server and click the `+` button or
"Create New Resume" in the startup dialog.

### Authenticated mode (requires Keystone)

For CMS read access (load/edit existing resumes), you need Keystone
running. Click the login button (user icon) in the header. This redirects to
the Cognito hosted UI; on success the SPA is authenticated and can use the
CMS. The auth-service (`apps/auth-service`, port 4000) brokers the OAuth flow;
Vite proxies `/api/auth` to it so the browser stays single-origin at 5173.

> **Cognito app client (`eu-central-1_BwgQjMok8`) must allow the callback URL**
> `http://localhost:5173/api/auth/callback/cognito` for local sign-in to work.

### Keystone CORS

In `nt-keystone-cms/keystone.ts`, ensure `CORS_ORIGIN` includes:

- `http://localhost:5173` (Vite dev server)
- `http://localhost:8787` (render service)

### Optional: seed data

Milestone 0-9 wire the load flow but do not seed. Use Keystone's admin UI (`http://localhost:3000/`) to create at least one `Resume`.

## Running

```sh
pnpm dev
```

This runs `apps/web`, `apps/render-service`, and `apps/auth-service` in parallel. Log lines are prefixed with the workspace name.

Or one at a time:

```sh
pnpm dev:web
pnpm dev:render
pnpm dev:auth
```

## Ports

| Service         | URL                        | Bound     |
|-----------------|----------------------------|-----------|
| Web (Vite)      | http://localhost:5173      | 0.0.0.0   |
| Auth service    | http://localhost:4000      | 127.0.0.1 |
| Render service  | http://localhost:8787      | 127.0.0.1 |
| Keystone CMS    | http://localhost:3000      | (external)|

## Environment variables

See `.env.example`:

- `VITE_GRAPHQL_ENDPOINT` — Keystone endpoint the SPA calls.
- `VITE_RENDER_ENDPOINT` — render service endpoint the SPA calls.
- `RENDER_PORT`, `RENDER_HOST` — where the render service listens (dev `.env` sets `8787`/`127.0.0.1`; code default is `5173`/`0.0.0.0`).
- `RENDER_ALLOWED_IPS` — comma-separated allowlist (dev sets `127.0.0.1,::1`; unset = open to all IPs).
- `RENDER_CORS_ORIGIN` — comma-separated allowlist (default `http://localhost:5173`).
- `RENDER_CACHE_MAX` — LRU size (default 100).
- `AUTH_PORT`, `AUTH_HOST` — where the auth service listens (default `4000`/`127.0.0.1`).
- `AUTH_URL` — externally visible app origin; callback is `{AUTH_URL}/api/auth/callback/cognito` (default `http://localhost:5173`).
- `TRUSTED_ORIGINS` — comma-separated CORS allowlist for the auth service (default `http://localhost:5173`).
- `DATABASE_URL` — Postgres **pooled** connection for the auth DB (runtime). PrismaPg adapter handles `search_path=auth` isolation — no `?options=` query param needed. Target the `resume-auth` DB (port `5434`). Use a connection pooler (e.g., PgBouncer) for local dev. If using unpooled direct connection locally, omit `DIRECT_URL` and Prisma CLI will use `DATABASE_URL` for both runtime and migrations.
- `DIRECT_URL` — (Optional, only if `DATABASE_URL` is pooled) Postgres **direct** connection for migrations. Needed when running `prisma migrate` or `prisma db push` if your `DATABASE_URL` uses PgBouncer or similar. For local dev without a pooler, omit this — Prisma falls back to `DATABASE_URL`.
- `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET`, `COGNITO_DOMAIN`, `COGNITO_REGION`, `COGNITO_USERPOOL_ID` — Cognito app client (server-side only).
- `BETTER_AUTH_SECRET` — session secret; use `openssl rand -base64 32`.

## Regenerating GraphQL types

The generated file (`packages/graphql-client/src/generated.ts`) is a placeholder until you point codegen at a running Keystone:

```sh
pnpm codegen
```

Until then, hand-written operations in `packages/graphql-client/src/operations.ts` are the source of truth and mirror the `CmsResume` shape in `packages/transformer/src/types.ts`.

## Troubleshooting

**Preview iframe is blank / red banner.** Some themes throw on missing fields. Fill the missing section — the render service catches theme errors and shows an inline card instead of crashing.

**"Keystone unreachable" in the header.** Check that Keystone is running and that `VITE_GRAPHQL_ENDPOINT` matches. Also confirm CORS on the Keystone side.

**Save button is not shown.** Persistence is intentionally disabled — no Save button renders for any user. The typed save pipeline is retained and tested (see `docs/SAVE_PIPELINE.md`); it will be re-exposed when persistence is re-enabled.

**Component styles look broken (no borders, wrong colors).** Likely a Tailwind v4-only class from a shadcn update, or stale HSL/oklch token claims. Tokens are the CSS variables in `apps/web/src/index.css`, mapped via Tailwind v4 `@theme`. See CONTRIBUTING.md → UI components and FUNCTIONAL_REQUIREMENTS FR-12.
