# Save Pipeline

This document contains the complete save pipeline architecture for debugging and extending persistence.

---

## Load Flow

```
ResumePicker → useResume(id) → fromCms(cms) → loadFromCms({ json, cms })
```

## Load (guest mode / local create / import)

```
StartupDialog/ResumePicker → loadFromJson(EMPTY_RESUME) or loadFromJson(importedJson)
  → store populated locally, resumeId = null, originalCms = null
  → No GraphQL calls. Preview/export/print work. Save button hidden.
```

## Edit Flow

```
form onChange → patchResume → store.resume → PreviewFrame (300ms debounce) → POST /render
```

---

## Save Flow (the critical path)

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

---

## Zustand Store Invariants

1. `resume` = only thing forms mutate
2. `cmsIds[section][i] === null` → row added locally → save emits create
3. ID in `originalCmsIds` but absent from `cmsIds` → emit delete
4. `loadFromCms` resets everything atomically
5. `loadFromJson` populates the store for local imports/creates — `resumeId = null`, `originalCms = null`, all `cmsIds` are null

---

## The Mutation Pipeline (how saves work)

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
- New row (`cmsIds[i] === null`) → `create*` op with `resume: { connect: { id } }`
- Existing row with changes → `update*` op with diffed scalars
- Row removed from list → `delete*` op

**Special cases:**
- `work.highlights` → separate `ResumeHighlight` row ops (create/update/delete), NOT nested in work update
- `certificates` → shared global list accessed via `ResumeCertification` join table; create/delete go through `updateResume { resumeCertifications: { create/disconnect } }`; edits via `updateCertification` using `Certification.id`
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

---

## Debugging Save/Persistence Issues

1. **Check `schema.graphql` first.** Find the mutation name, input types, and field types. This is the source of truth.
2. **Compare with `operations.ts`.** Verify: mutation name matches, variable types match, return fields are sufficient.
3. **Check `toCms.ts` planner.** Trace the diff function for the affected section. Key questions:
   - Does the diff detect the change? (scalar comparison, relation matching)
   - Does it emit the right `kind`? (create vs update vs delete)
   - Does the data payload match the schema input type?
4. **Check `executeSave.ts`.** Verify the `runOne` case exists and passes correct variables.
5. **Check `types.ts`.** Verify `Cms*` interface matches what the GraphQL query actually returns.

---

## Verification Checklist for Save Changes

- `schema.graphql` mutation name matches `operations.ts` document name
- `toCms.ts` data payload shape matches schema input type
- `executeSave.ts` has a case for every new `MutationOp` kind (exhaustive switch enforces this)
- Tests in `packages/transformer/src/toCms.test.ts` cover the changed diff function