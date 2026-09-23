# Auth Service Instructions

- Runs Better Auth + Cognito OAuth broker for the SPA (Fastify).
- Bound to `127.0.0.1` only — never reachable directly from the browser.
- Only reachable via `/api/auth` proxies: Vite (dev, `apps/web/vite.config.ts`) or render-service (prod, `apps/render-service/src/server.ts`).
- Uses Postgres `auth` schema (via `search_path`) — never touch the Keystone `public` schema.
- Server-side env only: `DATABASE_URL`, `COGNITO_*`, `BETTER_AUTH_SECRET`. Never expose to Vite client bundles.
- Runs from source via `tsx` (do not bundle with Vite — better-auth uses OTel `withSpan` and a bundled build crashes). `build` is `tsc --noEmit`.
- Migration: `npx @better-auth/cli migrate --config apps/auth-service/src/auth.ts` (tables live in `auth` schema).
- The OAuth callback URL `{AUTH_URL}/api/auth/callback/cognito` must be registered on the Cognito app client.

## Key files

| File | Purpose |
|---|---|
| `src/auth.ts` | `betterAuth()` instance — Cognito social provider, Postgres pool (auth schema), `BETTER_AUTH_SECRET` |
| `src/server.ts` | Fastify bootstrap: CORS (TRUSTED_ORIGINS), catch-all `/api/auth/*` → `auth.handler()`, `/health` |

## Debugging tips

- **Sign-in fails / OAuth redirect loop**: Check the Cognito callback URL is registered; compare `AUTH_URL` vs the browser origin; check `TRUSTED_ORIGINS` includes the SPA origin.
- **Migrations**: Confirm the `auth` schema exists in the target DB and `DATABASE_URL` sets `search_path=auth`.
- **Secret**: `BETTER_AUTH_SECRET` must be stable across restarts or sessions invalidate.

## Project-specific skills

- Use `caveman` for all conversations until specifically requested otherwise.