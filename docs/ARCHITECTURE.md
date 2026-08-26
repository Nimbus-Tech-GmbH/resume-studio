# resume-studio — Architecture

Technical architecture for the resume-studio monorepo. For feature-level
behavior and "which file do I touch" guidance, see
[FUNCTIONAL_REQUIREMENTS.md](./FUNCTIONAL_REQUIREMENTS.md). For known gaps,
see [KNOWN_ISSUES.md](./KNOWN_ISSUES.md).

---

## 1. System overview

Three cooperating processes:

```
┌────────────────────────────────┐
│ Browser — React 19 SPA         │
│  apps/web (Vite, port 5173)    │
│                                │
│  Zustand store  ←→ form UI     │
│       │                        │
│       ├─ GraphQL ──────────┐   │
│       └─ POST /render      │   │
│          (debounced 300ms) │   │
└────────────────────────────┼───┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
┌───────────────────────────┐  ┌────────────────────────────┐
│ Keystone CMS (external)   │  │ Render Service             │
│ nt-keystone-cms           │  │ apps/render-service        │
│ http://localhost:3000     │  │ Fastify, port 8787         │
│ /api/graphql              │  │                            │
│                           │  │ POST /render               │
│ Source of truth for all   │  │  → theme render fn         │
│ resume data. Own repo;    │  │  → postProcess (head inject)│
│ schema mirrored in        │  │  → LRU cache (SHA-1 keyed) │
│ ./schema.ts + .graphql.   │  │ GET /health                │
└───────────────────────────┘  └────────────────────────────┘
```

- **Web** is the only user-facing surface. It never talks to the database.
- **Render service** is stateless besides an in-memory LRU. Local-only
  (loopback bind + IP allowlist). Must not be exposed publicly until auth
  exists (KNOWN_ISSUES A6).
- **Keystone CMS** lives in `nt-keystone-cms`. This repo only mirrors its
  schema (`schema.ts`, `schema.graphql`) as reference snapshots.

## 2. Monorepo layout

pnpm workspaces (`pnpm-workspace.yaml`):

```
apps/
  web/                    React SPA
  render-service/         Fastify theme renderer

packages/
  transformer/            CMS ⇄ JSON Resume codecs + diff planner (pure TS)
  graphql-client/         Hand-written GraphQL operations (+ codegen placeholder)
  themes/                 Theme registry: id → lazy import of vendored package
  vendor/jsonresume-theme-*   Vendored upstream JSON Resume themes (9)
```

Dependency direction (enforced by convention):

```
web ──▶ transformer ◀── render-service
 │                          │
 └──▶ graphql-client        └──▶ themes ──▶ vendor/*
```

`transformer` depends on nothing but its own files — it must stay pure so it
runs identically in browser and Node tests.

### Key packages/scripts

| Path | Role |
|---|---|
| `apps/web/components.json` | shadcn config (radix base, nova preset) — CLI managed |
| `apps/web/tailwind.config.ts` | Tailwind v3 theme; maps CSS vars via `hsl(var(--x))` |
| `apps/web/src/index.css` | Design tokens — **HSL triplets only** (see FR-12 rule 7) |
| `packages/transformer/src/types.ts` | `JsonResume*` (editor shape) + `Cms*` (CMS shape) interfaces |
| `packages/transformer/src/fromCms.ts` | CMS → JSON Resume (load path) |
| `packages/transformer/src/toCms.ts` | JSON Resume diff → mutation plan (save path) |
| `packages/transformer/src/listCodec.ts` | `string[] ⇄ delimited String` (`✌🏻`, legacy `\n`, `,;`) |
| `packages/transformer/src/dateCodec.ts` | `YYYY-MM-DD ⇄ ISO DateTime`, invalid → error |
| `packages/transformer/src/options.ts` | Canonical select option lists mirroring the CMS |
| `packages/graphql-client/src/operations.ts` | All GraphQL documents (queries + mutations) |
| `packages/themes/src/registry.ts` | Theme ids/labels, `isThemeId`, default theme |
| `packages/themes/src/themes.ts` | Lazy loaders dispatching to vendored packages |

## 3. Web app internals (`apps/web/src`)

```
src/
├── main.tsx                  Entry; routes '/' (App) vs '/print' (PrintPage)
├── App.tsx                   Shell: header (picker/theme/print/save), editor+preview grid
├── PrintPage.tsx             Standalone print view; reads payload key from localStorage
│
├── state/
│   ├── editorStore.ts        Zustand store — THE source of client truth
│   └── (themeStore removed)
│
├── editor/
│   ├── EditorPane.tsx        Tab layout; registers section forms
│   ├── sections/             One component per resume section
│   ├── fields/               Reusable field primitives (text/select/tags)
│   ├── SaveButton.tsx        Staleness check → plan → execute pipeline trigger
│   ├── ValidationBanner.tsx  Error/warning display from useValidation
│   ├── SortableList.tsx      Generic dnd-kit reorder wrapper
│   ├── ResumePicker.tsx      Loads list + selected resume into store
│   └── PrintButton.tsx       Opens /print with a localStorage payload key
│
├── preview/
│   ├── PreviewFrame.tsx      Debounced iframe preview
│   └── renderClient.ts       fetch wrapper for POST /render
│
├── validation/
│   ├── schema.ts             ajv schema mirroring CMS validations
│   └── useValidation.ts      Hook: store resume → ValidationIssue[]
│
├── graphql/
│   ├── client.ts             graphql-request client (credentials: include)
│   ├── useResume.ts          TanStack Query hooks + fetchResumeUpdatedAt
│   └── executeSave.ts        Executes MutationOp[] against the CMS
│
└── components/ui/            shadcn-style primitives (button, card, input…)
```

### State model (`state/editorStore.ts`)

Single Zustand store. No undo/redo (removed), no persistence.

```ts
interface EditorState {
  resume: JsonResume;        // live editing copy
  original: JsonResume;      // snapshot at load — diff base
  originalCms: CmsResume | null;
  cmsIds: CmsIdMap;          // live row ids; null = locally added row
  originalCmsIds: CmsIdMap;  // snapshot ids — delete detection base
  theme: ThemeId;
  resumeId: string | null;
  loadedUpdatedAt: string | null;  // staleness-check anchor
}
```

Invariants:

1. `resume` is the only thing forms mutate (via `patchResume` or section actions).
2. `cmsIds[section][i] === null` ⇒ row i was added locally ⇒ save emits a create.
3. An id present in `originalCmsIds` but absent from `cmsIds[section]` ⇒ emit delete.
4. `loadFromCms` resets everything atomically (switching resumes mid-edit discards changes).

### Data flow

**Load**

```
ResumePicker → useResume(id) [TanStack Query]
  → fromCms(cms) : JsonResume
  → loadFromCms({ json, cms })   // seeds all store slices
```

**Edit → preview**
### Edit → preview

```
form onChange → patchResume → store.resume updates
  → PreviewFrame effect (300ms debounce) → requestRender({resume, theme})
  → POST /render → HTML string → <iframe srcDoc>
```

**Preview loading states** (see FUNCTIONAL_REQUIREMENTS FR-3):

- First render (no HTML yet): skeleton placeholder block inside the preview
  pane (`Skeleton` from `components/ui/skeleton.tsx`), announced via
  `role="status"`.
- Subsequent renders: previous render stays visible; a translucent
  `bg-background/50` overlay signals the refresh. No flash of empty content.

### Resume picker loading states (FR-1)

- List loading: `Skeleton` shaped like the select trigger (`h-8 w-56`).
- Resume fetch in flight: small `Spinner` overlay inside the picker
  (`isFetching` from TanStack Query — refetches included).
- Select disabled while the selected resume is loading.

### Save button pending state (FR-5)

- While saving: `Spinner` (shadcn) with `data-icon="inline-start"`, label
  "Saving…", button disabled. Per shadcn convention Button has no `isPending`
  prop — compose Spinner + disabled instead.

**Edit → validation**

```
store.resume → useValidation → ajv validateResume
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
PrintButton → localStorage['print-<ts>'] = JSON{resume, theme}
  → window.open('/print?k=<key>')
PrintPage → reads key → requestRender → full-height iframe → window.print()
  → removes payload key
```

localStorage is used because the print tab cannot share Zustand state.

## 4. Render service internals (`apps/render-service/src`)

```
server.ts      Fastify bootstrap: CORS, IP allowlist hook, routes
render.ts      renderResume(resume, theme): cache check → renderTheme → postProcess
cache.ts       LRU (default 100 entries, 15min TTL), SHA-1(theme + resume JSON)
auth.ts        ipAllowlist middleware — 403 unless req.ip ∈ RENDER_ALLOWED_IPS
postProcess.ts Injects viewport meta + print-color CSS; wraps partial HTML
preload.ts     Node loader: stubs `.css` imports (React themes import CSS)
css-hook.mjs   ESM resolve hook backing preload.ts
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
```

Note: workspace packages export TS sources directly, so production start
requires a TS loader (`node --import tsx/esm`). See KNOWN_ISSUES A5.

## 5. Transformer contract

Rule: `toCms(fromCms(x))` round-trips, modulo delimiter normalization to `✌🏻`.

| JSON Resume | CMS | Codec / notes |
|---|---|---|
| `skills[].keywords: string[]` | `keywords: String` | `encodeList` / `decodeList` |
| `interests[].keywords` | same | same |
| `volunteer[].highlights` | same | same |
| `projects[].highlights` | same | same |
| `education[].courses` | same | same |
| `work[].highlights: string[]` | `ResumeHighlight[]` relation rows | positional id matching; create/update/delete ops |
| dates `YYYY-MM(-DD)` | ISO DateTime | `dateCodec`; invalid blocks save |
| `certificates[]{name,url,summary}` | `Certification{title,link,description}` | rename map; shared global list (S4) |
| `basics.image: string` | `Image` relation | read-only (A3/S2) |
| skill `level`, language `fluency` | CMS `select` options | `options.ts` canonical lists |

Mutation op ordering guarantee (`executeSave`): creates before updates before
deletes, so new-row references are safe.

## 6. Cross-cutting decisions

- **Editor shape = JSON Resume, not CMS.** All forms operate on `JsonResume`;
  conversion happens only at load/save boundaries. Adding a field means
  touching types → fromCms/toCms → form — see FUNCTIONAL_REQUIREMENTS §7.
- **No auth anywhere yet.** All requests send `credentials: 'include'` so a
  future session cookie works without call-site changes.
- **Validation mirrors the CMS**, not the official JSON Resume schema — the
  CMS is what will actually reject a write. Enum mismatches on legacy data are
  warnings, not errors.
- **Themes are vendored**, not npm-installed, so preview output is pinned.
  Registry pattern keeps imports lazy (fast boot, pay-per-use).
- **Tailwind v3 + shadcn v4 registry mismatch** is handled by rewriting
  v4-only classes after every component add/update (checklist in
  FUNCTIONAL_REQUIREMENTS FR-12 rule 6). Token values stay HSL triplets so
  `hsl(var(--x))` mappings in `tailwind.config.ts` remain valid.
- **Testing**: Vitest everywhere. Transformer has unit + property tests;
  web tests pure logic only (validation); render-service tests postProcess.
  No component/E2E tests yet.

## 7. Environments & configuration

| Var | Consumer | Default |
|---|---|---|
| `VITE_GRAPHQL_ENDPOINT` | web | `http://localhost:3000/api/graphql` |
| `VITE_RENDER_ENDPOINT` | web | `http://localhost:8787` |
| `RENDER_PORT` / `RENDER_HOST` | render-service | `8787` / `127.0.0.1` |
| `RENDER_ALLOWED_IPS` | render-service | `127.0.0.1,::1` |
| `RENDER_CORS_ORIGIN` | render-service | `http://localhost:5173` |
| `RENDER_CACHE_MAX` | render-service | `100` |

Keystone side must allow CORS from both web origins (5173, 8787).
