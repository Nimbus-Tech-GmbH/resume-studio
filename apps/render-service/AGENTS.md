# Render Service Instructions

- Keep the service stateless and localhost-only.
- Preserve the Vite SSR self-contained bundle.
- Theme failures must return the inline error card.
- Cache keys are SHA-1 hashes of render input.
- When `AUTH_TARGET` is set in env, `/api/auth/*` is proxied to the auth-service so the SPA stays single-origin (plain node http pass-through; hop-by-hop headers stripped). Only GET/POST.
- Dev script loads the root `.env` (`--env-file=../../.env`) — render listens on `RENDER_PORT`.
- After dependency/import changes, build this package and verify `dist/server.js` runs without `node_modules`.

## Key files

| File | Purpose |
|---|---|
| `vite.config.ts` | Vite SSR build config — bundles all deps into self-contained JS |
| `src/cache.ts` | SHA-1 keyed LRU cache |
| `src/themeRunner.ts` | Theme execution + error boundary |
| `src/server.ts` | Fastify server + `/render` endpoint + `/api/auth` proxy |

## Debugging tips

- **Theme errors**: Caught by theme runner; returned as inline error card (not thrown)
- **Cache issues**: Same input = same output via SHA-1; check `cache.ts` for LRU eviction
- **Build issues**: Run `pnpm --filter @resume-studio/render-service build`; verify `dist/server.js` + `dist/assets/*.js` are self-contained
- **Import issues**: All workspace deps bundled; new imports must work in SSR bundle
- **Auth proxy issues**: `AUTH_TARGET` must be set; check auth-service logs and that `localhost:8787` matches the SPA fallback (`VITE_RENDER_ENDPOINT`)

## Project-specific skills

- Use `caveman` for all conversations until specifically requested otherwise.