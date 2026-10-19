# Local Dev

## Prerequisites

- Node `>= 20.11` (`.nvmrc` pins `20.11.0`)
- pnpm `>= 9`
- Keystone CMS running locally (required only for authenticated CMS flows)
- Local Postgres for auth-service (`resume-auth-db`, port `5434`)

---

## First-time setup

```sh
pnpm install
cp .env.example .env
```

Create auth DB container if needed:

```sh
docker run -d --name resume-auth-db \
  -e POSTGRES_USER=admin -e POSTGRES_PASSWORD=dev-auth-pass \
  -e POSTGRES_DB=resume-auth -p 127.0.0.1:5434:5432 \
  postgres:15-bookworm
```

Apply auth schema migration:

```sh
psql "postgres://admin:dev-auth-pass@127.0.0.1:5434/resume-auth" \
  -f apps/auth-service/migrations/auth-schema.sql
```

---

## Run

```sh
pnpm dev
```

Or individually:

```sh
pnpm dev:web
pnpm dev:render
pnpm dev:auth
```

Ports:
- Web: `http://localhost:5173`
- Render: `http://localhost:8787`
- Auth: `http://127.0.0.1:4000`
- Keystone: `http://localhost:3000` (external repo)

---

## Mode behavior

### Guest mode

- No GraphQL calls
- Local create/import/edit/preview/print flow works without Keystone
- Local session data only

### Authenticated mode

- Requires Keystone + auth-service env config
- Browser stays single-origin via `/api/auth` proxy
- Cognito callback must include:
  - `http://localhost:5173/api/auth/callback/cognito`

Keystone CORS should allow:
- `http://localhost:5173`
- `http://localhost:8787`

---

## Environment variables

See `.env.example` for canonical list.

Key groups:
- Web: `VITE_GRAPHQL_ENDPOINT`, `VITE_RENDER_ENDPOINT`
- Render service: `RENDER_*`
- Auth service: `AUTH_*`, `TRUSTED_ORIGINS`, `DATABASE_URL`, `COGNITO_*`, `BETTER_AUTH_SECRET`

Notes:
- `DATABASE_URL` targets auth DB; pool sets `search_path=auth`.
- `COGNITO_*` and `BETTER_AUTH_SECRET` are server-side only.

---

## GraphQL codegen

```sh
pnpm codegen
```

Until fully wired to live Keystone, `packages/graphql-client/src/operations.ts`
remains the practical source of truth for queried/mutated fields.

---

## Troubleshooting

- **Preview errors/blank iframe:** check render service health and payload validity.
- **Keystone unreachable:** verify `VITE_GRAPHQL_ENDPOINT` + Keystone CORS.
- **Save behavior confusion:** check current product state and `docs/SAVE_PIPELINE.md`.
