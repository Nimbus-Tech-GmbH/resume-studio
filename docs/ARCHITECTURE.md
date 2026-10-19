# resume-studio — Architecture

High-level technical architecture for this monorepo.

For implementation requirements and file-level change maps, see
`docs/FUNCTIONAL_REQUIREMENTS.md`.
For save internals, see `docs/SAVE_PIPELINE.md`.
For active limitations, see `docs/KNOWN_ISSUES.md`.

---

## 1) System overview

Runtime components:

1. **Web app** (`apps/web`, Vite, `:5173`)
   - React SPA + Zustand editor store
   - Guest/authenticated modes
   - Calls:
     - `/render` for preview/print
     - `/api/auth/*` for sign-in/session
     - Keystone GraphQL (authenticated reads)

2. **Render service** (`apps/render-service`, Fastify, dev `:8787`)
   - Stateless HTML renderer + in-memory LRU cache
   - `POST /render` and `GET /health`
   - In production, also proxies `/api/auth/*` to auth-service

3. **Auth service** (`apps/auth-service`, Fastify, `127.0.0.1:4000`)
   - Better Auth + Cognito broker
   - Uses Postgres `auth` schema only

4. **Keystone CMS** (external repo)
   - Source of truth for resume content
   - Schema mirrored as snapshots in `schema.ts` and `schema.graphql`

### Non-negotiable boundaries

- `apps/web` never accesses DB directly.
- Guest mode performs no GraphQL calls.
- Auth flows go through `/api/auth` proxy to keep browser single-origin.
- `packages/transformer` remains dependency-free and environment-agnostic.
- Render/auth services are localhost-only in dev and must not be exposed without proper controls.

---

## 2) Monorepo layout and dependency direction

```txt
apps/
  web/
  render-service/
  auth-service/

packages/
  transformer/
  graphql-client/
  themes/
  vendor/
```

Dependency direction:

```txt
web ──▶ transformer ◀── render-service
 │                         │
 └──▶ graphql-client       └──▶ themes ──▶ vendor/*
```

---

## 3) Core data and interaction model

### Editor state

`apps/web/src/state/editorStore.ts` is the single client source of truth.

Key invariants:
- `resume` is the form-mutated state.
- `cmsIds[section][i] === null` means local row (create on save planning).
- ID present in `originalCmsIds` but absent in current IDs means delete.
- `loadFromCms` resets state atomically.
- `loadFromJson` creates local-only state (`resumeId = null`, no CMS backing).

### Main runtime flows

- **Load (auth):** GraphQL → `fromCms` → `loadFromCms`
- **Load (guest/import):** JSON/template → `loadFromJson`
- **Edit/preview:** form mutation → debounce 300ms → `POST /render` → iframe update
- **Validation:** store resume → Zod rules mirroring CMS
- **Save pipeline:** documented in `docs/SAVE_PIPELINE.md` (currently retained while save UI exposure is controlled by product state)
- **Print:** payload passed via localStorage key into `/print` route

---

## 4) Service internals

### Render service

Primary modules:
- `server.ts` (Fastify bootstrap, routes, optional auth proxy)
- `render.ts` (theme render lifecycle)
- `cache.ts` (LRU)
- `auth.ts` (IP allowlist middleware)
- `postProcess.ts` (HTML post-processing)

Request shape:
- `POST /render` validates payload, resolves theme renderer, returns HTML.
- Theme failures are returned as renderable error HTML (do not crash the editor).

### Auth service

Primary modules:
- `auth.ts` (Better Auth configuration)
- `server.ts` (Fastify catch-all `/api/auth/*`)

Notes:
- Callback URL is `{AUTH_URL}/api/auth/callback/cognito`.
- Apply schema with `apps/auth-service/migrations/auth-schema.sql`.

---

## 5) Transformer contract

`packages/transformer` handles CMS ⇄ JSON Resume conversion and mutation planning.

Important mappings:
- Multi-value text fields use list codec (`string[]` ⇄ delimited string).
- Dates use codec (`YYYY-MM(-DD)` ⇄ ISO datetime).
- Work highlights are independent relation rows.
- Certificates are shared entities via join rows.
- `basics.image` is relation-backed in CMS; planner emits relation payloads but end-to-end behavior remains explicitly tracked in known issues.

Mutation execution order is **creates → updates → deletes**.

---

## 6) Configuration surface

Primary env families:
- Web: `VITE_GRAPHQL_ENDPOINT`, `VITE_RENDER_ENDPOINT`
- Render service: `RENDER_*`, optional `AUTH_TARGET`
- Auth service: `AUTH_*`, `TRUSTED_ORIGINS`, `DATABASE_URL`, `COGNITO_*`, `BETTER_AUTH_SECRET`

Use `.env.example` + `docs/LOCAL_DEV.md` for local setup details.
