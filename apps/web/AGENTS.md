# Web Instructions

- GraphQL is gated by `isAuthenticated` (Better Auth session).
- Guest mode must not invoke GraphQL.
- Forms mutate only `editorStore.resume`.
- Preview requests use the 300 ms debounce.
- Save is hidden from the UI for all users (persistence to be re-enabled later); the save pipeline stays in place and tested.
- Auth requests go to `/api/auth` on the SPA origin; Vite proxies to the auth-service (never call `127.0.0.1:4000` directly).
- Logout resets the store via `resetAll()` and reopens the startup dialog.
- Never import server-side auth env vars (`DATABASE_URL`, `COGNITO_*`, `BETTER_AUTH_SECRET`) into the client bundle.
- For load bugs, inspect `RESUME_FIELDS`, `CmsResume`, and `fromCms.ts` together.
- For validation bugs, inspect `apps/web/src/validation/schema.ts` and CMS validation definitions.

## AI tailoring

- Ollama or the OpenCode inference API. The browser calls it through `@resume-studio/ai/browser`; there is no `/api/ai` route.
- `packages/ai` owns the Vercel AI SDK setup, the OpenCode OpenAI-compatible provider, prompt, strict Zod response schema, JSON Resume validation, change ledger, grouping, and apply/undo transforms.
- The model returns one JSON object with exactly `resume`, `changes`, and `gaps`; validate with `validateTailoredResponse` and `assertJsonResumeValid` before display or persistence.
- `resume` is the accept-all preview. Never replace the editor document with it.
- Partial accept starts from the editor document and applies only the selected change groups.
- Contact fields in `WITHHELD_PATHS` are stripped from the model copy and restored from the editor copy.
- Model listing uses Ollama's `/v1/models` index or the OpenCode `/inference/v1/models` catalog. All inference goes through the Vercel AI SDK. OpenCode API keys stay in memory only and are stripped from recovery records.
- OpenCode inference is proxied through `/api/ai/opencode/*` in Vite (dev) and render-service (prod) because it does not send browser CORS headers.
- JSON Resume MCP is opt-in only, sends resume data to `jsonresume.org`, and may call only `validate_resume`, `get_resume_schema`, and `check_ats`.
- Preserve JSON-editor synchronization checks (`jsonBuffer.isValid` / `!isDirty`) before Generate and Apply.
- Apply through `commitResumeTransaction` only — never `loadFromJson`, GraphQL save, or CMS mutations.
- Refresh restores conversation, analysis, decisions, and settings without credentials.
- Logout / clear recovery: abort any in-flight AI request.

## Key files

| File | Purpose |
|---|---|
| `src/auth/AuthContext.tsx` | AuthProvider + useAuth hook (session-gated) |
| `src/auth/authClient.ts` | Better Auth client (`createAuthClient`), same-origin `/api/auth` |
| `src/state/editorStore.ts` | Zustand store — single source of client truth; `EMPTY_RESUME` template; `resetAll()` on logout |
| `src/editor/SaveButton.tsx` | Staleness check → plan → execute pipeline; not rendered while save is disabled |
| `src/validation/schema.ts` | zod schema mirroring CMS validations |
| `src/graphql/executeSave.ts` | Runs `MutationOp[]` against CMS sequentially |
| `src/components/StartupDialog.tsx` | Launch dialog — guest Sign in, resume list, create/import |
| `src/features/ai-tailoring/` | AI panel, Ollama client, strict validation/apply/undo |
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