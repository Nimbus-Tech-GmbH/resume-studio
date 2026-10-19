# Save Pipeline

Focused reference for persistence planning/execution.

This document intentionally covers **save internals only**.
General app architecture and load/preview flows are documented in
`docs/ARCHITECTURE.md`.

---

## 1) Current product state

- The typed save pipeline remains implemented and tested.
- UI exposure of save is controlled by product state; consult current web UI behavior before assuming end-user save availability.

---

## 2) Save critical path

`SaveButton` orchestration:

1. Guard on required store state (`resumeId`, `originalCms`)
2. Staleness check (`fetchResumeUpdatedAt` vs `loadedUpdatedAt`)
3. Plan (`toCms`) → `{ ops, errors }`
4. Stop on planner errors
5. Execute ops sequentially in order: **creates → updates → deletes**
6. On all-success: invalidate resume query and reload from server
7. On partial failure: report failure, no client rollback

---

## 3) Planner (`packages/transformer/src/toCms.ts`)

Inputs:
- `current`, `original` (`JsonResume`)
- `originalCms`
- `cmsIds`, `originalCmsIds`
- `resumeId`

Output:
- `MutationOp[]`
- planner `errors`

Core row lifecycle:
- `cmsIds[i] === null` → create op
- existing ID + changed payload → update op
- ID removed from current map but present in original map → delete op

Special cases:
- `work.highlights` as dedicated row CRUD
- `certificates` via `ResumeCertification` join handling + `updateCertification`
- `basics.location` / `basics.profiles` as separate row ops
- `basics.image` relation payload on change (`create/disconnect`) — track A3/S2 caveat

---

## 4) GraphQL mapping (`packages/graphql-client/src/operations.ts`)

Every `MutationOp.kind` must map to a schema-accurate mutation document.

When adding/changing an op kind:
- update `MutationOp` union
- add/update GraphQL document
- update executor switch
- keep exhaustive switch guarantees intact

---

## 5) Executor (`apps/web/src/graphql/executeSave.ts`)

- Buckets ops by kind prefix for deterministic ordering.
- Executes sequentially and returns per-op success/failure results.
- Does not attempt transaction-style rollback.

---

## 6) Debugging checklist

1. Verify mutation/input shape in `schema.graphql`.
2. Verify document in `operations.ts` matches schema.
3. Trace planner branch in `toCms.ts` for the affected section.
4. Verify `executeSave.ts` handles the op kind.
5. Confirm transformer tests cover the changed planner behavior.

Recommended test focus:
- `packages/transformer/src/toCms.test.ts`
