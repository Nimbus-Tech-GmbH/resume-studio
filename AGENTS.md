# AGENTS.md

Instructions for AI agents working on this codebase. Read this first.

---

## Architecture (3 processes)

```
Browser (React SPA, port 5173)
  ├── GraphQL ──→ Keystone CMS (external, port 3000, /api/graphql)
  └── POST /render ──→ Render Service (Fastify, port 8787, localhost only)
```

- **Keystone CMS** = source of truth for ALL resume data. Lives in separate repo `nt-keystone-cms`. This repo mirrors its schema (`schema.ts`, `schema.graphql`) as snapshots.
- **Web** = editor UI. Never talks to DB directly. All persistence goes through GraphQL mutations.
- **Render service** = stateless theme renderer. No auth yet (A6). Must stay localhost.

## Monorepo layout

```
apps/
  web/                    React SPA (Vite, Zustand, TanStack Query)
  render-service/         Fastify theme renderer

packages/
  transformer/            CMS ⇄ JSON Resume codecs + diff planner (PURE TS, no deps)
  graphql-client/         Hand-written GraphQL operations (queries + mutations)
  themes/                 Theme registry + lazy loaders
  vendor/                 Vendored JSON Resume themes
```

Dependency direction: `web → transformer ← render-service`, `web → graphql-client`.

`transformer` must stay pure — runs identically in browser and Node tests.

## Key files

| File | What it does |
|---|---|
| `packages/transformer/src/types.ts` | `JsonResume*` (editor) + `Cms*` (CMS) interfaces |
| `packages/transformer/src/fromCms.ts` | CMS → JSON Resume (load) |
| `packages/transformer/src/toCms.ts` | JSON Resume diff → `MutationOp[]` (save planner) |
| `packages/graphql-client/src/operations.ts` | All GraphQL documents (queries + mutations) |
| `apps/web/src/graphql/executeSave.ts` | Runs `MutationOp[]` against CMS sequentially |
| `apps/web/src/state/editorStore.ts` | Zustand store — single source of client truth |
| `apps/web/src/editor/SaveButton.tsx` | Staleness check → plan → execute pipeline |
| `apps/web/src/validation/schema.ts` | ajv schema mirroring CMS validations |
| `schema.graphql` | Keystone schema snapshot (read-only reference) |

## Data flow

### Load
```
ResumePicker → useResume(id) → fromCms(cms) → loadFromCms({ json, cms })
```

### Edit
```
form onChange → patchResume → store.resume → PreviewFrame (300ms debounce) → POST /render
```

### Save (the critical path)
```
SaveButton onClick:
  1. Staleness: fetchResumeUpdatedAt(id) ≠ loadedUpdatedAt? → BLOCK
  2. Plan: toCms({current, original, originalCms, cmsIds, originalCmsIds, resumeId})
     → { ops: MutationOp[], errors: ValidationError[] }
  3. Errors? → show, stop
  4. Execute: sort ops (creates → updates → deletes), run sequentially
  5. All ok → invalidateQueries → refetch re-seeds store
     Failed → toast; local state untouched (no rollback — A1)
```

### Zustand store invariants
1. `resume` = only thing forms mutate
2. `cmsIds[section][i] === null` → row added locally → save emits create
3. ID in `originalCmsIds` but absent from `cmsIds` → emit delete
4. `loadFromCms` resets everything atomically

## The mutation pipeline (how saves work)

This is the most important system to understand for debugging save issues.

### Step 1: `toCms.ts` — the planner

Diffs `current` (live editor state) against `original` (load snapshot) using `originalCms` (CMS row data) and `cmsIds`/`originalCmsIds` (row ID tracking).

Produces `MutationOp[]` — a discriminated union:
```ts
type MutationOp =
  | { kind: 'createResumeWork'; data: Record<string, unknown> }
  | { kind: 'updateResumeWork'; id: string; data: Record<string, unknown> }
  | { kind: 'deleteResumeWork'; id: string }
  // ... one variant per entity × operation
```

**How row lifecycle works:**
- New row (cmsIds[i] === null) → `create*` op with `resume: { connect: { id } }`
- Existing row with changes → `update*` op with diffed scalars
- Row removed from list → `delete*` op

**Special cases:**
- `work.highlights` → separate `ResumeHighlight` row ops (create/update/delete), NOT nested in work update
- `certificates` → shared global list; create/delete go through `updateResume { certificates: { create/disconnect } }`; edits via `updateCertification`
- `basics.location` → separate `ResumeLocation` row ops
- `basics.profiles` → separate `ResumeProfile` row ops
- `basics.image` → relation payload `{ create: { src } }` or `{ disconnect: true }` (A3 — CMS-side unverified)

### Step 2: `operations.ts` — GraphQL documents

Each `MutationOp.kind` maps to a named GraphQL mutation document. **These names MUST match `schema.graphql` exactly.**

Schema pattern: `createResumeWork(data: ResumeWorkCreateInput!): ResumeWork`
Operation: `mutation CreateResumeWork($data: ResumeWorkCreateInput!) { createResumeWork(data: $data) { id } }`

### Step 3: `executeSave.ts` — the executor

`runOne(op)` switch on `op.kind` → `gqlClient.request(DOCUMENT, variables)`.

Ops sorted: bucket 0 (creates) → bucket 1 (updates) → bucket 2 (deletes). Within each bucket, order matches planner output.

## How to debug any issue

### Debugging save/persistence issues

1. **Check `schema.graphql` first.** Find the mutation name, input types, and field types. This is the source of truth.
2. **Compare with `operations.ts`.** Verify: mutation name matches, variable types match, return fields are sufficient.
3. **Check `toCms.ts` planner.** Trace the diff function for the affected section. Key questions:
   - Does the diff detect the change? (scalar comparison, relation matching)
   - Does it emit the right `kind`? (create vs update vs delete)
   - Does the data payload match the schema input type?
4. **Check `executeSave.ts`.** Verify the `runOne` case exists and passes correct variables.
5. **Check `types.ts`.** Verify `Cms*` interface matches what the GraphQL query actually returns.

### Debugging data loading issues

1. **Check `RESUME_FIELDS` fragment in `operations.ts`.** Missing fields → silently `undefined` in editor.
2. **Check `fromCms.ts`.** Does the decoder handle null/undefined? Are codecs applied correctly?
3. **Check `types.ts` Cms* interfaces.** Do they match the actual GraphQL response shape?

### Debugging preview/render issues

1. **Render service is separate.** Check `apps/render-service/src/` — not the web app.
2. **Theme errors → error card.** Render service catches theme throws and shows inline card.
3. **Cache issues.** SHA-1 keyed LRU. Same input = same output. Check `apps/render-service/src/cache.ts`.

### Debugging UI/styling issues

1. **Tailwind v3, not v4.** shadcn CLI installs v4 classes that silently fail. Check `dist/assets/*.css` for compiled classes.
2. **Tokens must be HSL triplets.** `tailwind.config.ts` wraps in `hsl(var(--x))`. oklch values break this.
3. **shadcn components** live in `apps/web/src/components/ui/`. After add/update, rewrite v4 classes (FR-12 rule 6).

### Debugging validation issues

1. **Client validation mirrors CMS** (`apps/web/src/validation/schema.ts`). Not the JSON Resume spec.
2. **Legacy select values** (A7) → warnings, not errors. Don't block save.
3. **Regex duplication** (S7) — phone/email patterns exist in both CMS and client. Can diverge.

## Verification checklist

After any change, run:
```bash
pnpm typecheck && pnpm lint && pnpm test
```

For save-related changes, also verify:
- `schema.graphql` mutation name matches `operations.ts` document name
- `toCms.ts` data payload shape matches schema input type
- `executeSave.ts` has a case for every new `MutationOp` kind (exhaustive switch enforces this)
- Tests in `packages/transformer/src/toCms.test.ts` cover the changed diff function

For fragment/query changes, verify:
- `RESUME_FIELDS` in `operations.ts` includes all fields the editor needs
- `CmsResume` in `types.ts` matches the fragment shape
- `fromCms.ts` decodes every field the editor reads

## Common pitfalls

| Pitfall | Where | Fix |
|---|---|---|
| Mutation name typo | `operations.ts` | Compare letter-by-letter with `schema.graphql` |
| Missing `MutationOp` kind | `toCms.ts` type union | Add variant; exhaustive switch in `executeSave.ts` forces you to add the case |
| Missing fragment field | `operations.ts` RESUME_FIELDS | Add field; editor silently gets `undefined` without it |
| Schema drift | `schema.graphql` vs live CMS | Run `pnpm codegen` against live Keystone when available |
| Tailwind v4 class | shadcn add/update | Rewrite to v3; verify in compiled CSS |
| Positional matching bug | `diffHighlights` / `diffSection` | Use content-based matching, not index-based |
| Non-atomic save | `executeSave.ts` | Documented (A1). No fix without Keystone transactions. |
| `schema.ts` uses Keystone types | `packages/transformer/` | ESLint ignores it; don't import from transformer |

## Available skills

These agent skills are installed globally. Use the `skill` tool to load full instructions when relevant.

| Skill | When to use | Key trigger phrases |
|---|---|---|
| `caveman` | Token-efficient communication during long debug sessions. Drops filler, keeps all technical substance. | "caveman mode", "be brief", "less tokens" |
| `caveman-commit` | Generate Conventional Commits messages from staged diffs. Subject ≤50 chars, body only when why isn't obvious. | "write a commit", "commit message", "/commit" |
| `caveman-review` | Ultra-compressed code review comments. Each comment: location, problem, fix. | "review this PR", "code review", "/review" |
| `shadcn` | Add/fix/update shadcn/ui components. Critical for this project — shadcn CLI installs v4 classes that break under Tailwind v3. | "add component", "fix shadcn", "update button" |
| `vercel-react-best-practices` | React performance patterns (70 rules). Apply when writing/refactoring React components or optimizing renders. | "optimize render", "performance", "re-render" |
| `vercel-composition-patterns` | React compound components, render props, context providers. Use when refactoring components with boolean prop proliferation. | "refactor component", "composition", "compound" |
| `web-design-guidelines` | Review UI files against Web Interface Guidelines. Fetches fresh rules from source before each review. | "review UI", "check accessibility", "design audit" |

**Not relevant here:** `compress`, `find-skills`, `migrate-radix-to-base`, `vercel-react-view-transitions`.

## Related docs

- `docs/ARCHITECTURE.md` — full system architecture
- `docs/FUNCTIONAL_REQUIREMENTS.md` — per-feature requirements with file maps
- `docs/KNOWN_ISSUES.md` — living list of known issues
- `docs/DOMAIN_RELATIONSHIP.md` — resume domain model and entity relationships
- `docs/CONTRIBUTING.md` — workflow, conventions, code review checklist
- `docs/LOCAL_DEV.md` — setup, running, troubleshooting
