# resume-studio — Functional Requirements

Detailed, implementation-anchored requirements. Each requirement states the
behavior, the files to touch, and acceptance criteria. If you are adding or
changing a feature, find the relevant FR here and follow its file map.

Companion docs: [ARCHITECTURE.md](./ARCHITECTURE.md) (how the system works),
[KNOWN_ISSUES.md](./KNOWN_ISSUES.md) (known gaps).

Conventions used below:
- **Files** lists every file that must change for the requirement.
- **AC** = acceptance criteria (testable).
- "CMS" = Keystone in `nt-keystone-cms`; schema mirrored at repo root
  `schema.ts` / `schema.graphql`.

---

## FR-1 Resume selection and loading

**Behavior.** The header shows a dropdown of all resumes (title + language).
Selecting one loads it into the editor. On first load, the first resume in the
list is selected automatically.

**Files**
| File | Change |
|---|---|
| `apps/web/src/editor/ResumePicker.tsx` | Dropdown UI; auto-select first; loading states |
| `apps/web/src/graphql/useResume.ts` | `useResumeList`, `useResume`, `fetchResumeUpdatedAt` hooks |
| `packages/graphql-client/src/operations.ts` | `LIST_RESUMES`, `GET_RESUME` documents |
| `apps/web/src/state/editorStore.ts` | `loadFromCms` seeds all slices |

**Loading states**
- List query loading → `Skeleton className="h-8 w-56"` in place of the select.
- Selected resume fetching (`isFetching`) → small `Spinner` inside the picker;
  select disabled while the resume itself is loading (`isLoading`).
- Use TanStack Query flags (`isLoading`, `isFetching`, `error`) — never
  hand-rolled boolean state for fetch lifecycle.

**Rules**
1. Loading a resume replaces ALL editor state (`loadFromCms`) — unsaved edits
   on the previous resume are discarded without confirmation.
2. The GraphQL fragment must stay in sync with `CmsResume`
   (`packages/transformer/src/types.ts`). Adding a CMS field to edit ⇒ add it
   to `RESUME_FIELDS` too, or it will silently be `undefined`.
3. GraphQL errors surface inline in the picker (`Keystone error: …`), not as a crash.

**AC**
- [ ] With N resumes, dropdown lists N entries labeled `<title> (<lang>)`.
- [ ] Switching resumes resets forms, cmsIds, and validation state.
- [ ] Keystone down → picker shows error text; app does not crash.

---

## FR-2 Section editing

**Behavior.** Nine tabs: Basics, Work, Education, Skills, Interests,
Volunteer, Projects, Certificates, Languages. Every field maps 1:1 to a
`JsonResume*` type in `packages/transformer/src/types.ts`. Edits update the
store immediately (no save button per field); persistence is FR-5 only.

**Files**
| File | Change |
|---|---|
| `apps/web/src/editor/EditorPane.tsx` | Register a new tab/section |
| `apps/web/src/editor/sections/*.tsx` | Per-section forms (one file per section or grouped in `SimpleForms.tsx`) |
| `apps/web/src/editor/fields/Fields.tsx` | Reusable primitives: `TextField`, `TextAreaField`, `SelectField`, `KeywordsField` |
| `apps/web/src/state/editorStore.ts` | Only if a new list section is added (`ListSection`, id-map plumbing) |

**Field-type rules**
1. Free text → `TextField`; long text → `TextAreaField`.
2. CMS `select` fields → `SelectField` with options from
   `packages/transformer/src/options.ts` (never hardcode option lists in a form).
3. `string[]` stored delimited in CMS → `KeywordsField` (tag input).
4. Dates → `TextField` with `YYYY-MM-DD` placeholder (validated FR-4).
5. URLs → `TextField type="url"`.

**Per-section field map** (JSON Resume field → input):

- **Basics**: name, label, email, phone, url, image URL (+ thumbnail preview),
  summary; location sub-card (city, region, countryCode, postalCode, address).
- **Work** (sortable): company, position, url, start, end, summary,
  highlights — rendered as numbered badges; clicking a badge opens
  a dialog with a textarea plus Delete / Cancel / Update buttons (clearing
  the text and updating deletes the row). "Add highlight" appends an empty
  row and opens the dialog.
- **Education** (sortable): institution, area, studyType, url, start, end,
  score, courses (tags).
- **Skills** (sortable): name, level (`SKILL_LEVELS` select), keywords (tags).
- **Interests**: name, keywords (tags).
- **Volunteer**: organization, position, url, start, end, summary,
  highlights (numbered badges with edit dialog).
- **Projects**: name, url, start, end, description, highlights (numbered
  badges with edit dialog).
- **Certificates**: name, url, summary.
- **Languages**: language, fluency (`FLUENCY_LEVELS` select).

**Sortable sections**: work, education, skills use `SortableList`
(dnd-kit). Reorder is UI-only — see FR-8.

**AC**
- [ ] Every keystroke updates preview within ~300ms (FR-3) without saving.
- [ ] Adding a row via "+ Add …" creates a local row with `cmsIds = null`.
- [ ] Remove row deletes it locally; save emits delete op (FR-5).

---

## FR-3 Live preview

**Behavior.** Right half of the screen renders the current resume+theme as
HTML inside a sandboxed iframe, refreshed 300ms after the last keystroke.

**Files**
| File | Change |
|---|---|
| `apps/web/src/preview/PreviewFrame.tsx` | Debounce, iframe, loading overlay, error card |
| `apps/web/src/preview/renderClient.ts` | HTTP call; `VITE_RENDER_ENDPOINT` |
| `apps/render-service/src/render.ts` | Server-side render pipeline |

**Rules**
1. Debounce 300ms; abort in-flight requests on newer edits (AbortController).
2. Theme render errors must NOT blank the editor: service returns an HTML
   error card; client shows transport errors in a non-destructive panel.
3. Iframe sandbox: `allow-same-origin allow-scripts` (print page adds
   `allow-modals`). Never load theme JS outside the iframe.
4. Empty/initial state renders whatever the theme does with `{}` — no special
   casing in the client.
5. **Loading states:**
   - First render (no HTML yet): skeleton placeholder (`Skeleton` component,
     `components/ui/skeleton.tsx`) mimicking a resume layout — heading line,
     text lines, content block. Wrapped in `role="status"` + aria-label.
   - Re-renders after first paint: keep previous HTML visible, overlay a
     translucent `bg-background/50` layer. Never unmount the iframe between
     edits — prevents white flash and scroll-position loss.
   - Never use raw `animate-pulse` divs or ad-hoc spinners; use the shadcn
     `Skeleton` / `Spinner` components.

**AC**
- [ ] Typing pauses 300ms → exactly one render request.
- [ ] Render-service down → error panel; typing still works; recovery when up.
- [ ] Theme that throws → red error card inside iframe; editor usable.

---

## FR-4 Validation

**Behavior.** Every store mutation re-validates the resume. Issues show in a
banner under the header. Errors block Save; warnings do not.

**Files**
| File | Change |
|---|---|
| `apps/web/src/validation/schema.ts` | ajv schema + severity mapping |
| `apps/web/src/validation/useValidation.ts` | Hook |
| `apps/web/src/validation/schema.test.ts` | Tests — every rule needs one |
| `apps/web/src/editor/ValidationBanner.tsx` | Display |
| `apps/web/src/editor/SaveButton.tsx` | Gate: `severity !== 'error'` |

**Rules — mirror the CMS, not the JSON Resume spec** (the CMS is what rejects
writes). Current rules:

| Rule | Severity | Source |
|---|---|---|
| basics.email required + CMS regex | error | `ResumeBasicInformation.email` |
| basics.phone matches CMS regex if present | error | `ResumeBasicInformation.phone` |
| skill.level ∈ SKILL_LEVELS | warning (legacy data) | `ResumeSkill.level` select |
| language.fluency ∈ FLUENCY_LEVELS | warning (legacy data) | `ResumeLanguage.fluency` select |
| work.name/position/startDate present | error | `isRequired` |
| education.institution present | error | `isRequired` |
| skill.name, language.language present | error | `isRequired` |
| volunteer.organization/position present | error | `isRequired` |
| project.name/description present | error | `isRequired` |
| dates match `YYYY-MM(-DD)` | error | dateCodec contract |
| urls valid URI if present | error | hygiene |

1. Empty strings are treated as absent (deepClean) — do not flag blanks.
2. Enum mismatches are warnings because legacy CMS rows predate the select
   constraints (see KNOWN_ISSUES A7/S3). Do not "fix" this back to errors.
3. When the CMS changes a validation, update: `schema.ts` (rule), the table
   above, and `schema.test.ts`.

**AC**
- [ ] Invalid email → banner error; Save disabled.
- [ ] German resume with legacy fluency values → warnings shown; Save enabled.
- [ ] Fixing the last error re-enables Save immediately.

---

## FR-5 Save

**Behavior.** Explicit Save button. Diffs live state vs load snapshot,
produces a typed mutation plan, executes sequentially against the CMS.

**Files**
| File | Change |
|---|---|
| `apps/web/src/editor/SaveButton.tsx` | Pipeline orchestration + staleness gate |
| `packages/transformer/src/toCms.ts` | Diff → `MutationOp[]` planner |
| `apps/web/src/graphql/executeSave.ts` | Op execution + ordering |
| `packages/graphql-client/src/operations.ts` | One document per op kind |
| `packages/transformer/src/toCms.test.ts` | Planner tests |

**Pipeline (in order — do not reorder):**
1. Guard: no `originalCms`/`resumeId` → "No resume loaded".
2. Staleness: `fetchResumeUpdatedAt(id)` vs `loadedUpdatedAt`; mismatch →
   block with reload instruction (A2).
3. Plan: `toCms(...)`. Field-level codec errors (bad dates) → show paths, stop.
4. No ops → "Nothing to save."
5. Execute: sort creates → updates → deletes; sequential; collect per-op results.
6. All ok → invalidate `['resume', id]` (refetch re-seeds store).
   Failures → summary message; local state untouched (no rollback — A1).

**Pending state**
- While saving: `Spinner` (shadcn) with `data-icon="inline-start"`, label
  "Saving…", button disabled. Button has no `isPending` prop by design —
  compose Spinner + disabled (shadcn convention).

**Planner rules (`toCms`)**
- Row with `cmsIds[i] === null` → create op (with `resume: {connect:{id}}`).
- Id in `originalCmsIds` missing from live ids → delete op.
- Existing row: encode fields, emit update only if payload non-empty.
- Work highlights: positional matching against `cmsWork.highlights`;
  create/update/delete `ResumeHighlight` ops independently of the work row.
- Certificates: shared list — creates/deletes go through ONE
  `updateResume { certificates: { create/disconnect } }` op; edits via
  `updateCertification`.
- New op kind? Add to `MutationOp` union, `runOne` switch (exhaustive — the
  compiler will force you), and a graphql document.

**AC**
- [ ] No changes → "Nothing to save.", zero network mutations.
- [ ] Edit + add + remove in one section → single Save emits correct op mix.
- [ ] Server updatedAt changed since load → save blocked with message.
- [ ] Mid-plan failure → earlier ops persisted, failure reported, UI intact.

---

## FR-6 Theme switching

**Behavior.** Header dropdown of vendored themes. Switch re-renders preview;
theme choice lives in memory only (resets on reload).

**Files**
| File | Change |
|---|---|
| `apps/web/src/App.tsx` | Select bound to `store.theme` |
| `packages/themes/src/registry.ts` | `THEMES`, `DEFAULT_THEME`, `isThemeId` |
| `packages/themes/src/themes.ts` | Lazy loader map |

**Adding a theme (checklist):**
1. Vendor the package under `packages/vendor/jsonresume-theme-<name>`.
2. Add workspace dep to `packages/themes/package.json` AND
   `apps/render-service/package.json`.
3. Add id to `ThemeId` union + `THEMES` entry in `registry.ts`.
4. Add lazy import in `themes.ts` loaders map.
5. Add ambient module declaration in BOTH
   `packages/themes/src/shims.d.ts` and `apps/render-service/src/shims.d.ts`.
6. If the theme imports CSS, confirm the css-hook stub covers it (it does for
   `.css` imports).
7. Verify against a real resume — themes vary in optional-field tolerance.

**AC**
- [ ] Unknown theme id in request → 400 from render service.
- [ ] Switching theme triggers exactly one re-render.

---

## FR-7 Print / PDF export

**Behavior.** Preview button opens `/print` in a new tab: full-height rendered
iframe + Print button (browser dialog → Save as PDF). This is the only PDF
path (A4).

**Files**
| File | Change |
|---|---|
| `apps/web/src/editor/PrintButton.tsx` | Payload handoff |
| `apps/web/src/PrintPage.tsx` | Print view |
| `apps/web/src/main.tsx` | Route split (`/print`) |

**Rules**
1. Payload travels via localStorage key `print-<timestamp>` (tabs don't share
   Zustand). Key is single-use: removed after read.
2. Iframe sandbox includes `allow-modals` so `window.print()` works.
3. `@media print` CSS in `index.css` hides chrome; keep it print-safe.
4. Loading state: skeleton block + `Spinner` + "Rendering resume…" text,
   wrapped in `role="status"`. Same components as FR-3.

**AC**
- [ ] Missing/expired/corrupt key → friendly error + Back button, no crash.
- [ ] Print dialog produces paginated vector PDF.

---

## FR-8 Drag-and-drop reorder

**Behavior.** Work, education, skills cards are reorderable via handle drag
(pointer + keyboard). Order affects preview immediately but is NOT persisted
(no CMS `order` field — S1/A8).

**Files**
| File | Change |
|---|---|
| `apps/web/src/editor/SortableList.tsx` | Generic dnd wrapper (shared) |
| `apps/web/src/state/editorStore.ts` | `reorderItems` moves item + id in parallel |
| section files (FR-2 map) | Wire `onReorder` |

**Rules**
1. `cmsIds[section]` must be reordered in lockstep with items — the save
   planner matches originals by id, so desync corrupts diffs.
2. One drag handle per card (the `handle` node from SortableList). Don't add
   decorative grip icons.
3. If CMS later gains `order: Int`: persist in `toCms` using the existing
   `reorderSet` helper in `diff.ts`, then update this FR.

**AC**
- [ ] Drag then save → no order-related mutation ops emitted.
- [ ] Reload after save → order reverts (expected, documented).

---

## FR-9 Image preview (basics.image)

**Behavior.** Basics form has an Image URL field plus an 80×80 thumbnail
preview beside it. Broken URLs fall back to a dashed placeholder. Edits are
preview-only — not persisted (A3/S2).

**Files**
| File | Change |
|---|---|
| `apps/web/src/editor/sections/BasicsForm.tsx` | `ImagePreview` component |
| `packages/transformer/src/toCms.ts` | `flattenBasics` excludes `image` (keep excluded until S2 resolved) |

**Rules**
1. Error flag resets when URL changes (derived-state pattern during render,
   NOT setState-in-effect — lint enforces this).
2. Persisting requires resolving S2 first: run codegen, inspect
   `ResumeBasicInformationUpdateInput`, add relation payload in `toCms`, then
   move image out of the exclusion and update KNOWN_ISSUES.

**AC**
- [ ] Valid URL → thumbnail; broken → placeholder; empty → placeholder.
- [ ] Save never emits an `image` field in any op.

---

## FR-10 Multi-language resumes

**Behavior.** Resumes are per-language (CMS `Language` relation: en-US,
de-DE, en-IN). The picker treats each language variant as a separate resume.
Legacy fluency/level values in non-English resumes may trigger warnings (FR-4).

**Files**
| File | Change |
|---|---|
| `apps/web/src/editor/ResumePicker.tsx` | Label includes language |
| `packages/transformer/src/options.ts` | Canonical option lists (language-neutral values) |

**Rules**
1. Option values are canonical English strings matching the CMS select values
   exactly — do not translate them per resume language.
2. Legacy off-list values must remain editable (warning, not error).

---

## FR-11 Health & observability (render service)

**Behavior.** `GET /health` returns `{ok:true}`. Structured logs via Fastify
logger; blocked IPs logged at warn level.

**Files**
| File | Change |
|---|---|
| `apps/render-service/src/server.ts` | Routes, env parsing |
| `apps/render-service/src/auth.ts` | Allowlist middleware |

**Rules**
1. Env vars parsed at startup with defaults (see ARCHITECTURE §7); invalid
   port numbers fail fast via Fastify listen error path.
2. Library modules (`render.ts`, `cache.ts`, `postProcess.ts`) do not log —
   logging belongs to server/request scope.
3. Never log full resume payloads (PII).

---

## FR-12 Build, test, lint gates

**Behavior.** CI-equivalent local gates; all must pass before commit.

```sh
pnpm typecheck   # tsc --noEmit across workspace
pnpm lint        # eslint (flat config, root)
pnpm test        # vitest across workspace
pnpm build       # web: tsc -b && vite build; render: tsc + copy css-hook
```

**Files**
| File | Change |
|---|---|
| `eslint.config.js` | Lint rules/ignores (vendor/, generated.ts, schema.ts already ignored) |
| `*/vitest.config.ts` | Test include patterns (`src/**/*.test.ts`) |
| `apps/*/tsconfig.json` | Compile scopes — `src/**` only; root `schema.ts` unreachable by design |

**Rules**
1. New logic ⇒ tests, unless types-only/trivial. Bug fix ⇒ regression test.
2. No `any`, no non-underscore-prefixed unused vars, no console in library code.
3. `schema.ts` / `schema.graphql` are external-repo mirrors: never lint or
   typecheck them here; never import from app code.
4. **shadcn/ui components:** managed via CLI (`pnpm dlx shadcn@latest add …`)
   from `apps/web/`. `components.json` at `apps/web/components.json`
   (radix base, nova preset). Import alias `@/*` → `apps/web/src/*`
   (tsconfig paths + vite alias). Never hand-edit primitives except to apply
   a deliberate local change; when updating upstream use
   `--dry-run` + `--diff` and merge, don't blind-overwrite.
5. **Loading states:** use shadcn `Skeleton` (placeholder shapes) and
   `Spinner` (inline pending indicators). No raw `animate-pulse` divs, no
   ad-hoc `Loader2 animate-spin` markup. Buttons: compose Spinner +
   `disabled`, no `isPending` prop.
6. **Tailwind v3 constraint (important).** This project runs Tailwind v3.4,
   but current shadcn registry targets v4. After adding/updating a component,
   audit its classes and rewrite v4-only syntax:
   - Arbitrary CSS vars: `gap-(--x)` → `gap-[var(--x)]` or plain `gap-4`
   - `rounded-4xl` → `rounded-full`
   - `field-sizing-content` → not supported; set explicit min-h/rows
   - Important suffix `size-4!` → `size-4 !size-4` (or restructure)
   - Custom variants (`data-active:`, `data-horizontal:`) → explicit
     `data-[state=active]:`, `data-[orientation=horizontal]:`
   - `ring-3` → `ring-[3px]`
   Verify with `pnpm build`, then grep `dist/assets/*.css` for the class —
   if absent, it silently didn't compile.
7. **Design tokens must be HSL triplets.** `index.css` variables are wrapped
   by `tailwind.config.ts` as `hsl(var(--x))`. Never paste raw oklch values
   into the token blocks — `hsl(oklch(...))` is invalid and colors/borders
   silently disappear (this caused invisible card/dropdown borders once).
8. **Consistency rules:** inputs, selects, buttons share `rounded-lg`; form
   labels are `text-xs` AND control text (inputs, selects, dropdown lists) are `text-sm` —
   pass `className="text-sm"` on `SelectContent` so trigger and list match;
   keyword tags use `Badge` variant `secondary` inside a bordered container;
   dropdowns use default popper positioning (auto-flip) with solid
   `bg-popover` + border.
9. **Scrollbars:** thin (6px webkit / `scrollbar-width: thin`) and square
   (`border-radius: 0`), styled globally in `index.css`. Do not add per-
   component scrollbar styles.

---

## Appendix A — "Add a field to an existing section" recipe

Example: add `ResumeWork.department` (new CMS text field).

1. `packages/transformer/src/types.ts` — add `department?: string` to
   `JsonResumeWork` AND `CmsWork`.
2. `packages/graphql-client/src/operations.ts` — add `department` to the
   `work` selection in `RESUME_FIELDS`.
3. `packages/transformer/src/fromCms.ts` — map it in `mapWork`.
4. `packages/transformer/src/toCms.ts` — add `'department'` to the scalar-key
   loop in `diffWork`.
5. `apps/web/src/editor/sections/WorkForm.tsx` — add the `TextField`.
6. If CMS validates it: `apps/web/src/validation/schema.ts` + tests.
7. Tests: extend `toCms.test.ts` (emit-on-change) and `fromCms.test.ts`.

## Appendix B — "Add a whole new section" recipe

Example: awards (CMS list exists: `ResumeAward`).

1. `types.ts` — `JsonResumeAward` + add `awards` to `JsonResume` and
   `CmsResume`; add `awards` to `CmsIdMap` (transformer + editorStore copies).
2. `operations.ts` — selection in `RESUME_FIELDS` + create/update/delete docs.
3. `fromCms.ts` mapper; `toCms.ts` — reuse generic `diffSection` with an
   encoder fn (follow `encodeEducation` as template).
4. `editorStore.ts` — `SECTION_TO_RESUME_KEY`, `emptyIdMap`, `buildIdMap`,
   `cloneIdMap`.
5. `editor/sections/AwardsForm.tsx`; register in `EditorPane.tsx` TABS.
6. `executeSave.ts` — cases in `runOne` (exhaustive switch).
7. Validation rules + tests; planner tests.
8. Update ARCHITECTURE.md section map + this doc's FR-2 field map.

## Appendix C — Out of scope (do not build without explicit ask)

- Auth / public deploy (blocked phase).
- In-app PDF generation (Puppeteer decision pending).
- Undo/redo (deliberately removed).
- Persisting reorder (needs CMS `order` field).
- Editing profiles, awards, publications, references (read-only today).
