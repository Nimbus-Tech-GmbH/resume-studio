# Domain Relationship Notes

This document captures only the domain relationships that matter to this
repository’s editor/transformer/save pipeline.

For exact field definitions, treat `schema.graphql` and `schema.ts` as the
source-of-truth snapshots.

---

## 1) Aggregate shape used by the editor

`Resume` is the root aggregate loaded by the web app and transformed into
`JsonResume`.

Core child collections used by the editor:
- `work`
- `volunteer`
- `education`
- `awards`
- `publications`
- `skills`
- `resumeLanguages`
- `interests`
- `projects`
- `resumeCertifications` (join rows to shared `Certification`)

Nested/related structures with special handling:
- `basicInformation` (includes `location`, `profiles`, `image` relation)
- `work.highlights` (`ResumeHighlight` rows)

## 2) Relationship constraints that affect implementation

### C1. No persistent ordering fields (S1)
Most resume list relations lack explicit order columns.

**Effect in app:** drag-and-drop reorder is local/UI-only and can reset after reload.

### C2. Certificates are shared entities (S4)
Certificates are not resume-owned rows; resumes connect through join records.

**Effect in app:**
- attach/detach is done via `updateResume` nested relation updates
- editing a `Certification` can affect other resumes that share it

### C3. `basics.image` is relation-backed (S2)
JSON Resume uses a string URL; CMS uses an `Image` relation.

**Effect in app:** planner emits relation payloads on image changes, but behavior
must be validated end-to-end against live Keystone (A3).

### C4. Legacy select values exist (S3)
Older data can contain values outside current select option lists.

**Effect in app:** validation treats these as warnings (not blocking errors).

---

## 3) Editor/save mapping summary

The pipeline is:
1. CMS → `fromCms` → `JsonResume`
2. User edits `JsonResume`
3. `toCms` computes `MutationOp[]`
4. `executeSave` runs ops in create → update → delete order

Special mappings:
- `work.highlights` are separate row CRUD operations.
- `certificates` are managed via join relation updates plus `updateCertification`.
- `basics.location` and `basics.profiles` are separate row operations.
- `basics.image` is mapped as relation payload when changed.

See `docs/SAVE_PIPELINE.md` for full save details.

---

## 4) Practical guidance for schema changes

When CMS schema changes affect resume editing:
- update `packages/transformer/src/types.ts`
- update GraphQL operations in `packages/graphql-client/src/operations.ts`
- update `fromCms` and `toCms`
- update `apps/web/src/validation/schema.ts` if rules changed
- add/update tests (especially `packages/transformer/src/toCms.test.ts`)

If ordering fields are introduced in CMS, update both planner logic and docs to
remove the UI-only reorder constraint.
