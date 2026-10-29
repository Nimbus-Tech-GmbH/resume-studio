# resume-studio — Architecture

Technical architecture for the resume-studio monorepo. For feature-level
behavior and "which file do I touch" guidance, see
[FUNCTIONAL_REQUIREMENTS.md](./FUNCTIONAL_REQUIREMENTS.md). For known gaps,
see [KNOWN_ISSUES.md](./KNOWN_ISSUES.md).

---

## 1. System overview

Four cooperating processes (plus external CMS):

```
┌────────────────────────────────┐
│ Browser — React 19 SPA         │
│  apps/web (Vite, port 5173)    │
│                                │
│  AuthProvider (guest/auth)     │
│  Zustand store  ←→ form UI     │
│       │                        │
│       ├─ /api/auth ────────┐   │  [gated by session cookie]
│       ├─ GraphQL ──────┐   │   │   [gated by isAuthenticated]
│       └─ POST /render  │   │   │
│          (debounced 300ms)│   │
│                                │
│  Local Ollama ◀── direct loopback (AI tailoring)
└─────────────────────────┼───┼─┘
                          │   │
              ┌───────────┴───────────────┐
              ▼                           ▼
┌──────────────────────────┐  ┌───────────────────────────┐
│ Auth Service             │  │ Render Service            │
│ apps/auth-service        │  │ apps/render-service       │
│ Fastify, port 4000       │  │ Fastify, port 8787        │
│ /api/auth/*              │  │                           │
│ Better Auth + Cognito    │  │ POST /render              │
│ Postgres `auth` schema   │  │  → theme render fn        │
│ (separate DB)            │  │  → postProcess            │
│                          │  │ /api/auth/* (prod proxy)  │
│                          │  │ /health                   │
└────────────┬─────────────┘  └────────────┬──────────────┘
             │                             │
             └──────────────┬──────────────┘
                            ▼
              ┌───────────────────────────┐
              │ Keystone CMS (external)   │
              │ nt-keystone-cms           │
              │ http://localhost:3000     │
              │ /api/graphql              │
              │                           │
              │ Source of truth for all   │
              │ resume data. Own repo;    │
              │ schema mirrored in        │
              │ ./schema.ts + .graphql.   │
              └───────────────────────────┘
```

AI tailoring details: [AI_TAILORING.md](./AI_TAILORING.md). It runs against
local Ollama; applying AI change groups never saves to CMS.

- **Web** is the only user-facing surface. It never talks to the database.
  In **guest mode** (default), no GraphQL calls are made — create/import/preview/export work locally.
  In **authenticated mode**, CMS read access is available (load/edit).
  Persistence is currently disabled: the typed save pipeline is retained and
  tested but the Save button is not rendered.
  Auth requests go to `/api/auth`, proxied by Vite (dev) or render-service (prod) to the auth-service — the browser stays single-origin at 5173.
- **Auth service** brokers Better Auth + Cognito OAuth and stores users/sessions/accounts in the `auth` schema of its own Postgres database (dev: `resume-auth-db`, prod: the configured `DATABASE_URL`). It is stateful by design but only exposed locally / via the render-service proxy.
- **Render service** is stateless besides an in-memory LRU. Local-only
  (loopback bind + IP allowlist). Must not be exposed publicly until auth
  exists (KNOWN_ISSUES A6). In prod it also proxies `/api/auth` → auth-service.
- **Keystone CMS** lives in `nt-keystone-cms`. This repo only mirrors its
  schema (`schema.ts`, `schema.graphql`) as reference snapshots.

## 2. Monorepo layout

pnpm workspaces (`pnpm-workspace.yaml`):

```
apps/
  web/                    React SPA
  render-service/         Fastify theme renderer
  auth-service/           Fastify Better Auth + Cognito broker

packages/
  studio-contracts/       Versioned presentation input/status types (types only)
  resume-presentation/    Preview/print rendering lifecycle, transport, iframe UI, harness
  transformer/            CMS ⇄ JSON Resume codecs + diff planner (pure TS)
  ai-contracts/           AI tailoring response contract + strict validator/apply
  ai-runtime/             Ollama generation, prompt assembly, budget checks
  graphql-client/         Hand-written GraphQL operations (+ codegen placeholder)
  themes/                 Theme registry: id → lazy import of vendored package
  vendor/jsonresume-theme-*   Vendored upstream JSON Resume themes (9)
```

Dependency direction (enforced by convention):

```
web ──▶ resume-presentation ──▶ studio-contracts ──▶ transformer (types only)
 ├──▶ studio-contracts
 ├──▶ transformer
 ├──▶ graphql-client
 └──▶ ai-runtime ──▶ ai-contracts

render-service ──▶ transformer
               └──▶ themes ──▶ vendor/*
```

`transformer` depends on nothing but its own files — it must stay pure so it
runs identically in browser and Node tests. `studio-contracts` contains domain
types only. `resume-presentation` depends on that contract and React, never on
web-private paths, authentication, GraphQL, CMS IDs, or editor state.

### Key packages/scripts

| Path                                              | Role                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| `apps/web/components.json`                        | shadcn config — CLI managed                                      |
| `apps/web/src/index.css`                          | Design tokens, Tailwind v4 theme, keyframe animations            |
| `packages/studio-contracts/src/types.ts`          | Versioned immutable presentation input and status event contract |
| `packages/resume-presentation/src/controller.ts`  | Debounce/cancellation/stale-result lifecycle                     |
| `packages/resume-presentation/src/components.tsx` | Portable preview and print surfaces                              |
| `packages/transformer/src/types.ts`               | `JsonResume*` (editor shape) + `Cms*` (CMS shape) interfaces     |
| `packages/transformer/src/fromCms.ts`             | CMS → JSON Resume (load path)                                    |
| `packages/transformer/src/toCms.ts`               | JSON Resume diff → mutation plan (save path)                     |
| `packages/transformer/src/listCodec.ts`           | `string[] ⇄ delimited String` (`✌🏻`, legacy `\n`, `,;`)          |
| `packages/transformer/src/dateCodec.ts`           | `YYYY-MM-DD ⇄ ISO DateTime`, invalid → error                     |
| `packages/transformer/src/options.ts`             | Canonical select option lists mirroring the CMS                  |
| `packages/graphql-client/src/operations.ts`       | All GraphQL documents (queries + mutations)                      |
| `packages/themes/src/registry.ts`                 | Theme ids/labels, `isThemeId`, default theme                     |
| `packages/themes/src/themes.ts`                   | Lazy loaders dispatching to vendored packages                    |

## 3. Web app internals (`apps/web/src`)

```
src/
├── main.tsx                  Entry; routes '/' (providers + App) vs isolated '/print'
├── App.tsx                   Thin shell/workspace composition
├── PrintPage.tsx             Reads/validates print handoff; owns back navigation
│
├── shell/
│   └── StudioShell.tsx       Frame, branding, session/UI-theme controls, responsive layout, notifications
│
├── workspace/
│   ├── ResumeWorkspace.tsx   Active document, editor mode, validation, theme/presentation inputs
│   ├── printHandoff.ts       Versioned key-based localStorage handoff helpers
│   └── logout.ts             Reset-before-logout orchestration
│
├── auth/
│   └── AuthContext.tsx       AuthProvider + useAuth hook
│
├── state/
│   └── editorStore.ts        Authoritative editable document + persistence/lifecycle metadata
│
├── editor/
│   ├── EditorPane.tsx        Section forms and navigation
│   ├── sections/             One component per resume section
│   ├── fields/               Reusable field primitives
│   ├── SaveButton.tsx        Retained disabled persistence orchestration
│   ├── ValidationBanner.tsx  Error/warning display
│   ├── ResumePicker.tsx      Auth-gated CMS selection/load
│   └── ExportMenu.tsx        JSON export and /print handoff
│
├── validation/               CMS-compatible validation
└── graphql/                  Auth-gated reads + retained save executor
```

### Shell, workspace, and presentation boundary

- `StudioShell` owns global frame, branding, auth controls, application color
  theme, responsive panes/tabs, error containment, and notifications. It
  receives feature slots and does not import editor/store implementations.
- `ResumeWorkspace` owns active resume lifecycle, form/JSON mode, validation,
  theme/document inputs, editor composition, import/export integration, and
  logout reset callback.
- `PresentationInputV1` crosses the package boundary with only immutable JSON
  Resume data, stable document key, revision, and theme ID. CMS IDs, auth,
  GraphQL, save orchestration, and Zustand never cross it.
- `resume-presentation` owns HTTP rendering lifecycle and iframe display. Host
  explicitly configures `VITE_RENDER_ENDPOINT`; package itself reads no app env.

This package boundary prepares a future independently deployed presentation
frontend, but current implementation is a local workspace dependency. No
runtime federation or independent deployment is implemented.

### State model (`state/editorStore.ts`)

Single Zustand store. No undo/redo (removed), no persistence.

```ts
interface EditorState {
  resume: JsonResume; // live editing copy
  original: JsonResume; // snapshot at load — diff base
  originalCms: CmsResume | null;
  cmsIds: CmsIdMap; // live row ids; null = locally added row
  originalCmsIds: CmsIdMap; // snapshot ids — delete detection base
  theme: ThemeId;
  resumeId: string | null;
  documentKey: string | null; // stable client-only presentation identity
  documentRevision: number; // advances with editable snapshots
  loadedUpdatedAt: string | null; // staleness-check anchor
  isStartup: boolean; // true while startup dialog is active
}
```

Invariants:

1. `resume` is the only thing forms mutate (via `patchResume` or section actions).
2. `cmsIds[section][i] === null` ⇒ row i was added locally ⇒ save emits a create.
3. An id present in `originalCmsIds` but absent from `cmsIds[section]` ⇒ emit delete.
4. `loadFromCms` resets document, persistence metadata, stable `cms:<id>` key,
   and revision atomically (switching resumes mid-edit discards changes).
5. `loadFromJson` populates a new local/imported document with a fresh stable
   `local:<uuid>` key, no CMS backing, and null CMS IDs.
6. Form and JSON actions mutate the same `resume` and advance only
   `documentRevision`; lifecycle metadata is never serialized into JSON export.

### Data flow

**Load (CMS)**

```
ResumePicker → useResume(id) [TanStack Query]
  → fromCms(cms) : JsonResume
  → loadFromCms({ json, cms })   // seeds all store slices
```

**Load (JSON import)**

```
StartupDialog → file input → JSON.parse → validateResume
  → loadFromJson(json)   // seeds resume, original, cmsIds (all null),
                         // originalCms = null, resumeId = null
```

Imported resumes have no CMS backing — `resumeId` and `originalCms` are null,
but their local `documentKey` keeps editor/presentation active. A null
`documentKey` represents no active/fully loaded document. Saving remains
blocked because `originalCms` is null (see KNOWN_ISSUES A11).

### Edit → preview

```
form/JSON action → store.resume + documentRevision update
  → ResumeWorkspace builds PresentationInputV1
  → PreviewPresentation controller (one 300ms document debounce)
  → configured transport → POST /render → HTML string → sandboxed iframe
```

**Preview loading states** (see FUNCTIONAL_REQUIREMENTS FR-3):

- First render: loading placeholder announced with `role="status"`.
- Same-document revision refresh: previous successful HTML stays visible under
  an updating overlay.
- Theme changes render immediately with the latest document snapshot and cancel
  pending document debounce work.
- Different document keys clear old HTML immediately.
- Superseded requests are aborted and generation-guarded, so stale success,
  error, or completion handlers cannot update current state.
- Recoverable same-document failures retain prior HTML and expose Retry; retry
  always uses current input.

### Startup dialog (FR-1)

- On launch, if no resume is loaded, a modal dialog appears (`isStartup` flag
  in store). Behavior depends on auth mode:
  - **Guest mode:** Shows "Create a resume to get started. Your work won't be
    saved." with two buttons: "Create New Resume" (loads `EMPTY_RESUME` locally)
    and "Import JSON Resume". No GraphQL calls, no resume list.
  - **Authenticated mode:** Shows existing resumes as selectable buttons with
    title + language. Empty state briefly shows "No resumes" then fades out
    after 2 seconds. "Create New Resume" and "Import JSON Resume" buttons
    always visible.
    Dialog stays open until user selects, creates, or imports — `ResumePicker`
    auto-select is suppressed while `isStartup` is true.

- List loading: `Skeleton` shaped like the select trigger (`h-8 w-56`).
- Resume fetch in flight: small `Spinner` overlay inside the picker
  (`isFetching` from TanStack Query — refetches included).
- Select disabled while the selected resume is loading.

### Save button pending state (FR-5)

- Hidden for all modes while persistence is disabled (a "Save disabled" badge
  shows for authenticated users). The pipeline below is retained and tested;
  it resumes once persistence is re-enabled.
- While saving: `Spinner` (shadcn) with `data-icon="inline-start"`, button
  disabled. Entire save flow (including early-exit paths) wrapped in
  `try/finally` to guarantee the saving state is always cleared.

**Edit → validation**

```
store.resume → useValidation → zod validateResume
  → ValidationBanner (errors block Save; warnings don't)
```

**Save**

```
SaveButton onClick:
  1. fetchResumeUpdatedAt(id) ≠ loadedUpdatedAt? → block ("changed on server")
  2. toCms({current, original, originalCms, cmsIds, originalCmsIds, resumeId})
       → { ops: MutationOp[], errors: ValidationError[] }
  3. errors.length > 0 → show, stop
  4. executeSave(ops):
       sort ops: creates → updates → deletes
       run sequentially via graphql-client documents
       collect per-op OpResult{ok,error}
  5. all ok → invalidateQueries(['resume', id]) → refetch re-seeds store
     any failed → toast summary; local state untouched (no rollback)
```

### Print flow

```
ExportMenu → localStorage['print-<24-hex>'] =
             JSON{version: 1, createdAt, payload: {resume, theme}}
  → window.open('/print?k=<key>', noopener)
PrintPage → validates version/TTL/key → consumes/removes entry → PresentationInputV1
  → PrintPresentation (immediate render) → iframe → window.print()
```

`localStorage` is used only as a random-key cross-tab handoff because the print
tab has no editor store or auth lifecycle. Payload content never enters the URL;
the payload is removed when consumed. Versioned handoffs expire after 5 minutes
and stale entries are swept on application bootstrap and later exports, covering
blocked or failed tabs.

The print surface iframe is sandboxed with `allow-same-origin allow-modals`;
`allow-modals` is required or Chromium silently ignores `window.print()`. The
preview surface stays at `allow-same-origin` only (see
`packages/resume-presentation/src/components.tsx`).

## 4. Render service internals (`apps/render-service/src`)

```
server.ts      Fastify bootstrap: CORS, IP allowlist hook, routes, /api/auth prod proxy
render.ts      renderResume(resume, theme): cache check → renderTheme → postProcess
cache.ts       LRU (default 100 entries, 15min TTL), SHA-1(theme + resume JSON)
auth.ts        ipAllowlist middleware — 403 unless req.ip ∈ RENDER_ALLOWED_IPS
postProcess.ts Injects viewport meta + print-color CSS; wraps partial HTML
```

Request lifecycle:

```
POST /render {resume, theme}
  → ipAllowlist (403 if blocked)
  → validate body (400 on missing resume / unknown theme)
  → sha1(theme\0resumeJSON) → LRU hit? return
  → renderTheme(theme, resume)      // dynamic import, cached render fn
       on throw → HTML error card (iframe stays functional)
  → postProcess(html)
  → cache set → 200 text/html

GET|POST /api/auth/* (prod only, when AUTH_TARGET set)
  → proxied to auth-service so the SPA stays single-origin
```

Build: Vite SSR bundles all workspace packages (themes, transformer) and npm
deps into self-contained JS. Docker runtime needs only `node dist/server.js`
— no `node_modules`, no TS loader. See `apps/render-service/vite.config.ts`.

## 4a. Auth service internals (`apps/auth-service/src`)

```
auth.ts        betterAuth() — Cognito social provider, Postgres `auth` schema
server.ts      Fastify bootstrap: CORS, catch-all /api/auth/* → auth.handler()
```

Request lifecycle:

```
GET|POST /api/auth/*
  → CORS preflight (origins from TRUSTED_ORIGINS)
  → proxy host/headers into a Fetch Request via fromNodeHeaders
  → auth.handler(req) → Better Auth routes (sign-in/social, callback, session…)
  → response headers (Set-Cookie, Location) forwarded verbatim
```

- **Database layer:** Prisma Client + `@better-auth/prisma-adapter`. PrismaPg
  adapter (configured in `prisma/schema.prisma`) automatically sets
  `search_path=auth` at connection time, so Prisma queries read/write only the
  `auth` schema — never Keystone's `public` schema. The auth Postgres is its
  own database (dev: `resume-auth-db`, `postgres:15-bookworm`, host port 5434) — not Keystone's.
- **Migrations:** Prisma handles schema creation and migrations. Run `prisma
migrate deploy` (or `prisma db push` for local dev) to apply migrations from
  `apps/auth-service/prisma/migrations/`. Use `DIRECT_URL` if `DATABASE_URL`
  is pooled. Do NOT use the Better Auth CLI.
- The OAuth callback (`/api/auth/callback/cognito`) must be registered on the
  Cognito app client; the SPA hits `/api/auth` on its own origin so the
  callback URL is `{AUTH_URL}/api/auth/callback/cognito` (dev: 5173).

### User sync (Keystone ↔ auth-service)

Resume-studio's auth-service and Keystone CMS use separate databases. When a
Cognito user signs in, the auth-service creates a user record in its own auth
schema. To authorize GraphQL access, both databases must be linked.

**Linking via authId:**

1. On Cognito sign-in, the auth-service fires a signInUser callback
2. Callback looks up the Keystone user by email
3. Sets Keystone.authId = auth-service user ID
4. GraphQL queries authorize via Keystone.authId == session.user.id

**Bulk migration** for existing Keystone users:

pnpm --filter @resume-studio/auth-service migrate:keystone-users

Finds all Keystone users without an authId, creates matching auth-service
users, and links them.

See KEYSTONE_USER_SYNC.md for the complete data model, troubleshooting, and
end-to-end sign-in flow.

## 5. Transformer contract

Rule: `toCms(fromCms(x))` round-trips, modulo delimiter normalization to `✌🏻`.

| JSON Resume                        | CMS                                                                        | Codec / notes                                                         |
| ---------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `skills[].keywords: string[]`      | `keywords: String`                                                         | `encodeList` / `decodeList`                                           |
| `interests[].keywords`             | same                                                                       | same                                                                  |
| `volunteer[].highlights`           | same                                                                       | same                                                                  |
| `projects[].highlights`            | same                                                                       | same                                                                  |
| `education[].courses`              | same                                                                       | same                                                                  |
| `work[].highlights: string[]`      | `ResumeHighlight[]` relation rows                                          | content-based matching via `Map<value, id>`; create/update/delete ops |
| dates `YYYY-MM(-DD)`               | ISO DateTime                                                               | `dateCodec`; invalid blocks save                                      |
| `certificates[]{name,url,summary}` | `ResumeCertification` join table → `Certification{title,link,description}` | rename map; shared global list via join table (S4)                    |
| `basics.image: string`             | `Image` relation                                                           | read-only (A3/S2)                                                     |
| skill `level`, language `fluency`  | CMS `select` options                                                       | `options.ts` canonical lists                                          |

Mutation op ordering guarantee (`executeSave`): creates before updates before
deletes, so new-row references are safe.

## 6. Cross-cutting decisions

- **Editor shape = JSON Resume, not CMS.** All forms operate on `JsonResume`;
  conversion happens only at load/save boundaries. Adding a field means
  touching types → fromCms/toCms → form — see FUNCTIONAL_REQUIREMENTS §7.
- **Auth stub in place.** `AuthProvider` toggles between guest and
  authenticated modes. Guest mode bypasses all GraphQL calls. Real Cognito
  integration via Better Auth (`apps/auth-service`) — session state gates the
  SPA; see §8. All requests send `credentials: 'include'` so the session
  cookie flows without call-site changes.
- **Validation mirrors the CMS**, not the official JSON Resume schema — the
  CMS is what will actually reject a write. Enum mismatches on legacy data are
  warnings, not errors.
- **Themes are vendored**, not npm-installed, so preview output is pinned.
  Registry pattern keeps imports lazy (fast boot, pay-per-use).
- **Tailwind v4 + shadcn/ui.** Project migrated to Tailwind v4. shadcn
  components use v4-compatible classes. Token values are oklch (direct CSS
  vars in `index.css`), mapped to Tailwind utilities via `@theme`.
- **Testing**: Vitest everywhere. Transformer has unit + property tests; web
  covers validation, store invariants, guest query gates, logout, and print
  handoff. Presentation lifecycle tests use fake timers and controllable
  promises. Render-service tests postProcess. No browser E2E suite yet.

## 7. Environments & configuration

| Var                           | Consumer                    | Default                                      |
| ----------------------------- | --------------------------- | -------------------------------------------- |
| `VITE_GRAPHQL_ENDPOINT`       | web                         | `http://localhost:3000/api/graphql`          |
| `VITE_RENDER_ENDPOINT`        | web                         | `http://localhost:8787`                      |
| `RENDER_PORT` / `RENDER_HOST` | render-service              | `5173` / `0.0.0.0`                           |
| `RENDER_ALLOWED_IPS`          | render-service              | unset (open)                                 |
| `RENDER_CORS_ORIGIN`          | render-service              | `http://localhost:5173`                      |
| `RENDER_CACHE_MAX`            | render-service              | `100`                                        |
| `AUTH_TARGET`                 | render-service (prod proxy) | unset (proxy off)                            |
| `AUTH_PORT` / `AUTH_HOST`     | auth-service                | `4000` / `127.0.0.1`                         |
| `AUTH_URL`                    | auth-service                | `http://localhost:5173`                      |
| `TRUSTED_ORIGINS`             | auth-service                | `http://localhost:5173`                      |
| `DATABASE_URL`                | auth-service                | — (must point at a DB with an `auth` schema) |
| `COGNITO_*` (5 vars)          | auth-service                | —                                            |
| `BETTER_AUTH_SECRET`          | auth-service                | —                                            |

Table shows code defaults. Local dev overrides these via the root `.env`
(`RENDER_PORT=8787`, `RENDER_HOST=127.0.0.1`, `RENDER_ALLOWED_IPS=127.0.0.1,::1`,
`AUTH_PORT=4000`, etc.). With `RENDER_ALLOWED_IPS` unset the render service is
open to all IPs — keep it localhost-only via the `.env`.

Keystone side must allow CORS from both web origins (5173, 8787).
