# Local Dev

## Prereqs

- Node ≥ 20.11 (`.nvmrc` pins 20.11.0). `nvm use` if you use nvm.
- pnpm ≥ 9 (`corepack enable` will set it up automatically).
- The Keystone CMS from `nt-keystone-cms` running locally.

## First-time setup

```sh
pnpm install
cp .env.example .env
```

Edit `.env` if your Keystone or render endpoints differ from defaults.

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

This runs `apps/web` and `apps/render-service` in parallel. Log lines are prefixed with the workspace name.

Or one at a time:

```sh
pnpm dev:web
pnpm dev:render
```

## Ports

| Service         | URL                        | Bound     |
|-----------------|----------------------------|-----------|
| Web (Vite)      | http://localhost:5173      | 0.0.0.0   |
| Render service  | http://localhost:8787      | 127.0.0.1 |
| Keystone CMS    | http://localhost:3000      | (external)|

## Environment variables

See `.env.example`:

- `VITE_GRAPHQL_ENDPOINT` — Keystone endpoint the SPA calls.
- `VITE_RENDER_ENDPOINT` — render service endpoint the SPA calls.
- `RENDER_PORT`, `RENDER_HOST` — where the render service listens.
- `RENDER_ALLOWED_IPS` — comma-separated allowlist (default `127.0.0.1,::1`).
- `RENDER_CORS_ORIGIN` — comma-separated allowlist (default `http://localhost:5173`).
- `RENDER_CACHE_MAX` — LRU size (default 100).

## Regenerating GraphQL types

The generated file (`packages/graphql-client/src/generated.ts`) is a placeholder until you point codegen at a running Keystone:

```sh
pnpm codegen
```

Until then, hand-written operations in `packages/graphql-client/src/operations.ts` are the source of truth and mirror the `CmsResume` shape in `packages/transformer/src/types.ts`.

## Troubleshooting

**Preview iframe is blank / red banner.** Some themes throw on missing fields. Fill the missing section — the render service catches theme errors and shows an inline card instead of crashing.

**"Keystone unreachable" in the header.** Check that Keystone is running and that `VITE_GRAPHQL_ENDPOINT` matches. Also confirm CORS on the Keystone side.

**Save button is disabled.** The validation banner lists issues (top of editor). Fix the highlighted paths, then Save re-enables.

**Undo / redo do nothing after loading.** History clears on every fresh CMS load — expected.
