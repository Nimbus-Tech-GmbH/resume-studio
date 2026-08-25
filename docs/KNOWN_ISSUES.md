# Known Issues

Living list of known application and schema issues. Update as items are fixed
or discovered. Cross-reference `TODO.md` for completed work.

---

## Application issues

### A1. Save is not atomic

- **Where:** `apps/web/src/graphql/executeSave.ts`
- **What:** A save executes a plan of ordered mutations (creates → updates →
  deletes) one at a time. Keystone has no GraphQL transactions, so a mid-plan
  failure leaves the CMS partially updated with no rollback.
- **Impact:** Partial saves on error; the editor's local state then diverges
  from the server until reload.
- **Mitigation:** Per-op errors surface in the save toast; staleness check
  (A2) reduces the window for conflicting writes.
- **Status:** Accepted risk (PLAN §10.3).

### A2. Staleness check is advisory only

- **Where:** `apps/web/src/editor/SaveButton.tsx`, `state/editorStore.ts`
- **What:** The save-time check compares loaded vs live `updatedAt` and blocks
  the save if they differ — but it does not merge or warn *during* editing.
  Two tabs open on the same resume: the second tab's save is blocked, but the
  first tab never learns about the conflict until it tries to save.
- **Impact:** Last-write-wins within a single tab session.
- **Status:** Known limitation; full concurrent-edit protection deferred.

### A3. `basics.image` edits are preview-only

- **Where:** `packages/transformer/src/toCms.ts` (`flattenBasics`), `BasicsForm.tsx`
- **What:** The Image URL field updates local state and the live preview, but
  is excluded from mutation payloads. The CMS stores `image` as an `Image`
  relation (`ImageRelateToOneForUpdateInput`), and the correct payload shape
  (`create: { src }` vs `connect: { id }`) is unverified until codegen runs
  against live Keystone.
- **Impact:** Image changes are lost on save/reload.
- **Fix path:** Run `pnpm codegen`, inspect `ResumeBasicInformationUpdateInput`,
  wire the relation payload in `toCms`.

### A4. PDF export is browser-print only

- **What:** No in-app PDF generation. The `/print` page relies on the browser's
  Print → Save as PDF dialog.
- **Decision:** Client-side libs (html2pdf/jsPDF) rejected — rasterized text,
  broken pagination. Server-side Puppeteer viable later (~170–300MB Chromium)
  but not justified while the print dialog produces identical vector output.
- **Status:** Deferred; revisit if programmatic/no-dialog PDFs are needed.

### A5. Render service prod runtime needs a TS loader

- **Where:** `apps/render-service/package.json`, workspace packages
- **What:** `@resume-studio/themes` (and transformer) export TS sources
  directly (`"main": "./src/index.ts"`). The compiled `dist/server.js` cannot
  resolve them under bare Node — production start currently requires
  `node --import tsx/esm`. The Dockerfile implicitly depends on this too.
- **Impact:** Deploy needs tsx as a runtime dependency, or the workspace
  packages need real `tsc` builds with proper `exports` maps.
- **Status:** Works locally via tsx; flagged as deploy follow-up.

### A6. Render service must stay local-only

- **Where:** `apps/render-service/src/auth.ts`
- **What:** Only protection is an IP allowlist + CORS. No auth. Public
  deployment would let anyone render arbitrary payloads.
- **Status:** Blocked on auth phase (see TODO #1).

### A7. Legacy select values surface as warnings

- **Where:** `apps/web/src/validation/schema.ts`
- **What:** Resumes created before the Keystone `select` constraints existed
  may hold fluency/level values outside the canonical option lists (observed:
  German resume with "Verhandlungssicher"-style values). These are flagged as
  non-blocking warnings so rows stay editable/savable.
- **Impact:** Amber banner noise until values are normalized in the CMS.
- **Fix path:** Normalize legacy values to the canonical options
  (`SKILL_LEVELS` / `FLUENCY_LEVELS` in `packages/transformer/src/options.ts`),
  after which warnings disappear.

### A8. Reorder is UI-only

- **What:** Drag-and-drop reordering works in the editor but emits no
  mutations — the CMS lists have no `order` field, so order resets on reload.
- **Status:** Documented constraint (PLAN §2, types.ts header).

### A9. Profiles / awards / publications / references not editable

- **What:** The editor covers basics, work, education, skills, interests,
  volunteer, projects, certificates, languages. The schema also has
  `ResumeProfile`, `ResumeAward`, `ResumePublication`, `ResumeReference`
  which are read-only here (profiles feed `basics.profiles`; the rest aren't
  surfaced at all).
- **Status:** MVP scope decision; sections exist in the CMS.

### A10. Pre-existing lint warnings

- **Where:** shadcn ui components (`react-refresh/only-export-components`) and
  one `console.error` in `PrintButton.tsx`.
- **Impact:** Cosmetic; 0 errors.

---

## Schema issues

### S1. No `order` field on any resume relation

- **Where:** `schema.ts` — all `Resume*` lists
- **What:** Keystone relations return rows in arbitrary/insertion order. The
  editor preserves whatever order GraphQL returns, but there is no stable,
  user-controlled ordering.
- **Impact:** A8 above; resume section order can shift between loads.
- **Fix path:** Add `order: Int` to each `Resume*` list in the CMS, sort in
  `fromCms`, and emit reorder ops in `toCms` (the diff helper `reorderSet`
  already exists for this).

### S2. `ResumeBasicInformation.image` is a relation, not a scalar

- **Where:** `schema.ts` L809 — `relationship({ ref: "Image" })`
- **What:** JSON Resume models `basics.image` as a URL string; the CMS stores
  it as an Image record. Round-tripping requires either creating Image rows
  from URLs (Keystone image fields expect uploaded files, not arbitrary URLs)
  or connecting existing ones.
- **Impact:** A3 above — the main blocker for persisting image edits.
- **Fix path options:**
  1. Change the CMS field to a plain `text` URL (simplest; loses upload UX), or
  2. Add a dedicated `imageUrl` text field alongside the relation, or
  3. Implement an upload flow through Keystone's Image type.

### S3. Select constraints added after data entry

- **Where:** `schema.ts` — `ResumeSkill.level`, `ResumeLanguage.fluency`,
  `ResumeProfile.network`
- **What:** Fields were free `text` before becoming `select`s. Existing rows
  may hold off-list values that now fail strict validation.
- **Impact:** A7 above — handled as warnings client-side, but the CMS itself
  will reject those values on update until normalized.
- **Fix path:** One-time data migration in the CMS to map legacy strings onto
  canonical options.

### S4. `Certification` is a shared global list

- **Where:** `schema.ts` L328 — no `resume` back-reference
- **What:** Certifications are not owned by a Resume; create/delete goes
  through `updateResume { certificates: { create / disconnect } }`. Two
  resumes sharing a certification row edit the same underlying record.
- **Impact:** Cross-resume coupling; deleting a cert from one resume only
  disconnects it, but *editing* it changes it everywhere.
- **Status:** By design in the CMS, but surprising behavior worth documenting.

### S5. `ResumeWork.url` and several date fields have inconsistent requiredness

- **Where:** `schema.ts` L853+ — `url: isRequired: false` but
  `startDate: isRequired: true` on work; education has neither required;
  volunteer requires organization/position but no dates.
- **What:** Requiredness varies per list with no unifying rule, and the JSON
  Resume spec treats all of these as optional.
- **Impact:** Editor validation mirrors the CMS exactly (so users see CMS-
  accurate errors), but blank resumes can't be saved incrementally — e.g. a
  new work row must have name + position + startDate before any save passes.
- **Possible fix:** Relax `isRequired` in the CMS for draft-friendly editing,
  or keep as-is and accept stricter gating.

### S6. `schema.ts` / `schema.graphql` are checked into this repo as copies

- **What:** Both files mirror `nt-keystone-cms` but live here as static
  snapshots. They drift silently when the CMS evolves (this already happened
  once — see TODO "docs drift").
- **Mitigation:** ESLint ignores them (`schema.ts` uses Keystone-only types);
  types.ts documents the mirrored shape manually.
- **Fix path:** Generate `types.ts` + operations from introspection
  (`pnpm codegen` against live Keystone) instead of hand-maintaining copies.

### S7. Phone/email regexes are duplicated

- **Where:** `schema.ts` (CMS validation) and
  `apps/web/src/validation/schema.ts` (client copy)
- **What:** The same regex literals exist in two places. A change in the CMS
  won't propagate automatically.
- **Impact:** Client/server validation can diverge.
- **Fix path:** Same as S6 — derive client validation from generated schema
  metadata rather than copied literals.
