# Known Issues

Living list of active application and schema constraints.

---

## Application issues

### A1. Save is not atomic

- **Where:** `apps/web/src/graphql/executeSave.ts`
- **What:** Saves execute ordered mutations (creates → updates → deletes) one at a time. Keystone GraphQL does not provide transaction semantics here.
- **Impact:** Mid-plan failures can leave the CMS partially updated.
- **Status:** Accepted risk.

### A2. Staleness check is advisory only

- **Where:** `apps/web/src/editor/SaveButton.tsx`, `apps/web/src/state/editorStore.ts`
- **What:** Save checks `updatedAt` at click time and blocks if the server changed, but does not provide live conflict awareness while editing.
- **Impact:** Conflicts are only surfaced on save.
- **Status:** Known limitation.

### A3. `basics.image` persistence is unverified end-to-end

- **Where:** `packages/transformer/src/toCms.ts` (`diffBasics`)
- **What:** Planner emits relation payloads (`{ create: { src } }` / `{ disconnect: true }`) when `basics.image` changes, but live Keystone behavior has not been validated end-to-end.
- **Impact:** Image edits may not persist depending on CMS image handling.
- **Status:** Partially implemented; needs live verification.

### A4. PDF export is browser-print only

- **What:** No in-app PDF generation. Export relies on `/print` + browser Print → Save as PDF.
- **Status:** Deferred by design.

### A6. Render endpoint is unauthenticated

- **Where:** `apps/render-service/src/server.ts`, `apps/render-service/src/auth.ts`
- **What:** `/render` relies on host/IP controls, not user auth.
- **Impact:** Must remain localhost-only or IP-restricted in trusted environments.
- **Status:** Intentional for now.

### A7. Legacy select values surface as warnings

- **Where:** `apps/web/src/validation/schema.ts`
- **What:** Older CMS rows can contain off-list values for fields that are now `select`s.
- **Impact:** Warning noise until values are normalized.
- **Status:** Intentional warning-level handling.

### A8. Reorder is UI-only

- **What:** Drag-and-drop reorder updates local editor state, but is not persisted because CMS relations have no order field.
- **Status:** Documented constraint.

### A9. Profiles and references are not fully editor-surfaced

- **What:** The editor focuses on core sections; profile/reference handling is limited compared to schema breadth.
- **Status:** Scope limitation.

### A11. Local/imported resumes have no CMS backing

- **Where:** `apps/web/src/state/editorStore.ts` (`loadFromJson`)
- **What:** Guest/imported resumes are created locally with `resumeId = null` and `originalCms = null`.
- **Impact:** They are local-session data unless explicitly connected to CMS flow.
- **Status:** Intentional.

### A12. AI context budget is an estimate

- **Where:** `packages/ai-runtime/src/budget.ts`
- **What:** Preflight uses a conservative chars/token estimate, not Ollama’s tokenizer.
- **Impact:** May reject some prompts that would fit, or (rarely) still hit model overflow — both surface as `CONTEXT_TOO_LARGE` with no silent truncation.
- **Status:** Intentional fail-closed behavior; see `docs/AI_TAILORING.md`.

### A13. Hosted HTTPS → local HTTP AI bridges need browser permission

- **Where:** Browser Local Network Access / Ollama CORS
- **What:** Public HTTPS origins calling loopback may require explicit permission and exact `OLLAMA_ORIGINS`.
- **Impact:** Ollama can fail with actionable diagnostics even when the bridge is running.
- **Status:** Documented limitation.

---

## Schema issues

### S1. No explicit ordering field on resume relations

- **Where:** `schema.ts`
- **What:** Resume list relations do not expose a stable user-controlled order field.
- **Impact:** Reordered lists can reset on reload.
- **Fix path:** Add order fields in CMS and persist order in planner/executor.

### S2. `ResumeBasicInformation.image` is a relation, not a scalar URL

- **Where:** `schema.ts`
- **What:** JSON Resume models `basics.image` as string URL; CMS models it as relation.
- **Impact:** Mapping is non-trivial and still needs live verification (A3).

### S3. Select constraints were added after existing data

- **Where:** `schema.ts`
- **What:** Legacy records may hold values that do not match current option lists.
- **Impact:** Warnings in client; potential server-side validation failures on update.

### S4. `Certification` is shared across resumes

- **Where:** `schema.ts`
- **What:** Certification rows are global entities connected by join rows.
- **Impact:** Editing a shared certification can affect multiple resumes.

### S5. Requiredness varies by section

- **Where:** `schema.ts`
- **What:** Required fields differ across work/education/volunteer/etc.
- **Impact:** Validation and save UX are stricter/inconsistent in some paths.

### S6. `schema.ts` / `schema.graphql` are snapshots

- **What:** This repo mirrors external CMS schema files, so drift is possible.
- **Impact:** Operations and transformer types can go stale.
- **Fix path:** Regular codegen and schema sync checks.

### S7. Phone/email regexes are duplicated

- **Where:** CMS schema + client validation
- **What:** Validation patterns are maintained in two places.
- **Impact:** Potential client/server drift.
