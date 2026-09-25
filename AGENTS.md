# AGENTS.md

Instructions for agents working on this repository.

## Scope

This is a pnpm monorepo for a resume editor:

- `apps/web`: React/Vite editor.
- `apps/render-service`: Fastify/Vite SSR renderer.
- `apps/auth-service`: Fastify Better Auth + Cognito broker (Postgres `auth` schema).
- `packages/transformer`: pure CMS ⇄ JSON Resume codecs and save planner.
- `packages/graphql-client`: GraphQL documents.
- `packages/themes`: theme registry/loaders.
- `packages/vendor`: vendored JSON Resume themes.

Read the nearest nested `AGENTS.md` before editing files in a subproject.

## Non-negotiable boundaries

- `apps/web` never accesses the database directly.
- Authenticated persistence uses GraphQL mutations through `packages/graphql-client`.
- Auth requests go through `/api/auth`, proxied by Vite (dev) or render-service (prod) to the auth-service — the browser must stay single-origin at 5173.
- Guest mode performs no GraphQL calls; local create/import/preview/export must continue working.
- `packages/transformer` must remain dependency-free and runnable in browser and Node.
- The render service is stateless and must remain localhost-only.
- The auth-service is localhost-only (bound to `127.0.0.1:4000`) and only reachable via the proxies; it must never expose `public` schema DB access.
- `schema.graphql` is a read-only CMS schema snapshot; verify live drift with codegen when available.
- Do not change documented behavior or issue codes (`A1`, `A3`, `A7`, `S7`) without updating the related docs/tests.

## Important files

| Area | Files |
|---|---|
| Auth (web) | `apps/web/src/auth/AuthContext.tsx`, `apps/web/src/auth/authClient.ts` |
| Auth (service) | `apps/auth-service/src/auth.ts`, `apps/auth-service/src/server.ts` |
| Auth proxy | `apps/render-service/src/server.ts` (`/api/auth/*`) |
| Store | `apps/web/src/state/editorStore.ts` |
| CMS → editor | `packages/transformer/src/fromCms.ts` |
| Editor → CMS planner | `packages/transformer/src/toCms.ts` |
| GraphQL documents | `packages/graphql-client/src/operations.ts` |
| Save executor | `apps/web/src/graphql/executeSave.ts` |
| Validation | `apps/web/src/validation/schema.ts` |
| Renderer config | `apps/render-service/vite.config.ts` |
| CMS snapshot | `schema.graphql` |

## Save changes

Treat these files as one pipeline:

1. `toCms.ts`: detects changes and emits `MutationOp`.
2. `operations.ts`: maps each operation to a schema-compatible mutation.
3. `executeSave.ts`: executes operations sequentially.

For every new operation:

- Add the discriminated-union variant.
- Add the GraphQL document with exact schema mutation and variable types.
- Add the executor switch case.
- Preserve exhaustive-switch checking.
- Add planner tests in `packages/transformer/src/toCms.test.ts`.

Save ordering is creates → updates → deletes. Failed saves do not roll back local state.

Special mappings:

- Work highlights are separate rows.
- Certificates use the resume-certification join relation.
- Basics location and profiles are separate rows.
- Basics image uses a relation payload.

## Store invariants

- `resume` is the only form-mutated state.
- `cmsIds[section][i] === null` means create on save.
- An ID in `originalCmsIds` but not `cmsIds` means delete.
- `loadFromCms` resets the store atomically.
- `loadFromJson` creates a local resume with no CMS IDs or resume ID.

## Change verification

Use the narrowest relevant command first:

- Transformer change: run transformer typecheck/tests.
- GraphQL change: validate operations against `schema.graphql`.
- Web change: run web typecheck and relevant tests.
- Render change: build the render service.
- Auth change: run auth-service typecheck, plus web typecheck (client contract).
- Before finalizing a cross-cutting change: `pnpm typecheck && pnpm lint && pnpm test`.

Do not paste full logs into the response. Report the failing command and the relevant error excerpt.

## Common traps

- Tailwind is v4. Do not introduce Tailwind v3-only syntax or oklch tokens (tokens stay HSL triplets).
- Theme tokens are HSL triplets because config wraps them in `hsl(var(...))`.
- Match repeated rows by stable/content identity, not array position.
- Client validation mirrors CMS validation, not the JSON Resume specification.
- Legacy select values produce warnings, not save-blocking errors.
- Keep Keystone-specific types out of `packages/transformer`.
- Auth env (`DATABASE_URL`, `COGNITO_*`, `BETTER_AUTH_SECRET`) is server-side only — never import into Vite client bundles unless prefixed `VITE_`.

## Task-specific guidance

- Save/persistence: read `docs/SAVE_PIPELINE.md`.
- Domain relationships: read `docs/DOMAIN_RELATIONSHIP.md`.
- Full architecture: read `docs/ARCHITECTURE.md`.
- Auth wiring: read `docs/ARCHITECTURE.md` §4a + `docs/LOCAL_DEV.md`.
- UI/accessibility review: use the project UI review skill.
- shadcn changes: use the shadcn skill; this repo runs Tailwind v4 so registry classes apply as-is.

## Project-specific skills

- Use `shadcn` before adding or updating shadcn components; this repo runs Tailwind v4.
- Use `web-design-guidelines` for UI/accessibility reviews.
- Use `vercel-react-best-practices` for React performance work.
- Use `caveman` for all conversations until specifically requested otherwise.

## Non-negotiables
- ALWAYS use `caveman` skill for all conversations until specifically requested otherwise.
