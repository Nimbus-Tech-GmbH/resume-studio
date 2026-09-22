# TODO

### Docs drift (quick)
- ~~**README.md** still says "10 in-repo themes" including `brutalist` — update theme list (now 9 vendored) and mention Preview/print flow.~~ ✅ Done.
- ~~**PLAN.md §7** still references old stackoverflow/even/elegant themes — stale.~~ ✅ Done (also fixed stale theme refs in LOCAL_DEV + CONTRIBUTING).

### Recently completed
- **Guest mode + auth stub** — `AuthProvider` context with guest/authenticated toggle. Guest mode bypasses all GraphQL calls. Save button hidden for guests. ResumePicker shows only `+` button for guests. StartupDialog has guest phase (no resume list). Login/logout toggle button in header. Store resets cleanly on mode transition.
- **EMPTY_RESUME template** — blank JSON Resume with empty basics, all list sections as `[]`, and `meta.title: "Untitled Resume"`. Used by guest mode and create-new-resume flow.
- **Create new resume now local-first** — both StartupDialog and ResumePicker use `loadFromJson(EMPTY_RESUME)` instead of `CREATE_RESUME` mutation. No CMS round-trip until explicit Save.
- **Deployment docs** — step-by-step guide for deploying web to Vercel and render service to Northflank (`docs/DEPLOYMENT.md`).
- **Awards & publications editor sections** — added `JsonResumeAward`/`JsonResumePublication` types, `AwardsForm`/`PublicationsForm` components, CMS CRUD ops, and validation rules. Sections registered in `EditorPane.tsx`.
- **Validation migrated AJV → Zod** — replaced ajv/ajv-formats with Zod in `apps/web/src/validation/schema.ts`. Full field coverage including awards/publications. Updated tests.
- **Import JSON Resume** — file picker in StartupDialog validates `.json` uploads against the Zod schema and populates the editor locally (no CMS creation). Validation errors displayed in dialog.
- **Startup dialog** — modal on launch showing existing resumes + create new. Discriminated union phase state (`loading`/`error`/`empty`/`ready`). Auto-select suppressed via `isStartup` flag in store.
- **New resume creation** — `CREATE_RESUME` mutation + `useCreateResume` hook. Button in header (`+` icon) and startup dialog. Creates via GraphQL, invalidates list, loads immediately.
- **Save button saving state** — `try/finally` wrapping the entire save flow (including early exits). Spinner + disabled during save. Never stuck in loading state.
- **Responsive editor tabs** — horizontal scroll instead of wrapping; `line` variant; `TabsContent` replaces manual `hidden` divs.
- **App.tsx refactor** — extracted `Header`, `ThemePicker`, `EditorPanel`, `PreviewPanel`, `MobileLayout`, `PanelShell`, `EmptyPanel`. Mobile uses Radix `Tabs` instead of custom button group.
- **StartupDialog refactor** — discriminated union `DialogPhase` state, `useStartupDialogState` hook, `DESCRIPTIONS` record for dynamic text, extracted `LoadingState`/`ErrorState`/`EmptyFlash`/`ResumeList` sub-components.
- **Known issues cleanup** — removed T1 (Tailwind v3/v4 mismatch, now on v4), removed A9b body (highlights matching fixed).
- **Tailwind v4 migration** — project now uses `tailwindcss: ^4.3.3`.

### Known gaps / follow-ups
1. **Auth + public deploy** — Guest mode / auth stub implemented (`AuthProvider` with guest/authenticated toggle). Real Cognito integration + public deployment still deferred. *(Partial — UI toggle works, no real auth yet.)*
2. **PDF generation** — currently browser-print only; no in-app PDF export. *(Deferred — print flow documented in README; in-app export needs a new dependency decision.)*
3. ~~**Concurrent-edit protection** — last-write-wins; staleness check deferred.~~ ✅ Save-time staleness check added: store captures `loadedUpdatedAt`, `SaveButton` compares against live CMS `updatedAt` before executing ops.
4. **`basics.image` editing** — Image URL field added to Basics form (preview works immediately). `diffBasics` emits `{ create: { src } }` when URL is set and `{ disconnect: true }` when cleared. Payload shape matches `ImageCreateInput` from the schema. However, the actual round-trip (create Image row → connect to BasicInformation → persist → reload) has not been verified end-to-end against a live Keystone instance — the CMS Image type may expect file uploads, not arbitrary URLs. *(Needs live Keystone verification.)*
5. **Save atomicity** — no transactions; ordered ops accepted risk. *(Accepted risk per PLAN §10.3.)*
6. ~~**Testing** — transformer has tests, but web app and render-service have none (`passWithNoTests`).~~ ✅ Added: render-service `postProcess.test.ts` (3 tests), web `validation/schema.test.ts` (6 tests). Both apps now run vitest for real.
7. ~~**ESLint/Prettier** — listed in tech stack but not confirmed configured this session.~~ ✅ Root flat `eslint.config.js` (typescript-eslint + react-hooks + react-refresh); `pnpm lint` runs clean (9 pre-existing warnings only). Prettier was already configured.
8. ~~**Production build of render-service** — dev runs via tsx; `tsc` build + Dockerfile for deploy not exercised.~~ ✅ `pnpm build` compiles; `dist/server.js` boots and serves `/health` + `/render`. Fixes: `start` script now preloads `dist/preload.js`; build copies `css-hook.mjs` to dist; Dockerfile CMD updated. Note: workspace packages (`@resume-studio/themes`) still resolve to TS sources, so prod runtime needs a TS loader (tsx) or those packages need real builds — flagged as follow-up.
