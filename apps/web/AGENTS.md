# Web Instructions

- GraphQL is gated by `isAuthenticated` (Better Auth session).
- Guest mode must not invoke GraphQL.
- Forms mutate only `editorStore.resume`.
- Preview requests use the 300 ms debounce.
- Save is hidden for guests.
- Auth requests go to `/api/auth` on the SPA origin; Vite proxies to the auth-service (never call `127.0.0.1:4000` directly).
- Logout resets the store via `resetAll()` and reopens the startup dialog.
- Never import server-side auth env vars (`DATABASE_URL`, `COGNITO_*`, `BETTER_AUTH_SECRET`) into the client bundle.
- For load bugs, inspect `RESUME_FIELDS`, `CmsResume`, and `fromCms.ts` together.
- For validation bugs, inspect `apps/web/src/validation/schema.ts` and CMS validation definitions.

## Key files

| File | Purpose |
|---|---|
| `src/auth/AuthContext.tsx` | AuthProvider + useAuth hook (session-gated) |
| `src/auth/authClient.ts` | Better Auth client (`createAuthClient`), same-origin `/api/auth` |
| `src/state/editorStore.ts` | Zustand store — single source of client truth; `EMPTY_RESUME` template; `resetAll()` on logout |
| `src/editor/SaveButton.tsx` | Staleness check → plan → execute pipeline; hidden for guests |
| `src/validation/schema.ts` | zod schema mirroring CMS validations |
| `src/graphql/executeSave.ts` | Runs `MutationOp[]` against CMS sequentially |
| `src/components/StartupDialog.tsx` | Launch dialog — guest Sign in, resume list, create/import |
| `src/components/ui/` | shadcn components (Tailwind v4) |

## Debugging tips

- **Save issues**: Check `toCms.ts` planner → `operations.ts` documents → `executeSave.ts` executor in sequence
- **Load issues**: Check `RESUME_FIELDS` fragment in `packages/graphql-client/src/operations.ts`; missing fields silently return `undefined`
- **Preview issues**: Render service is separate (`apps/render-service/`) — check its logs
- **Auth issues**: Check auth-service logs (`apps/auth-service/`) and the `/api/auth` proxy; confirm the Cognito callback URL is registered
- **Styling issues**: Tailwind v4; verify compiled CSS in `dist/assets/*.css`

## Project-specific skills

- Use `shadcn` before adding or updating shadcn components; this repo runs Tailwind v4.
- Use `web-design-guidelines` for UI/accessibility reviews.
- Use `vercel-react-best-practices` for React performance work.
- Use `caveman` for all conversations until specifically requested otherwise.