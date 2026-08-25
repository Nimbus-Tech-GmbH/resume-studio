Needs Doing

### Docs drift (quick)
- ~~**README.md** still says "10 in-repo themes" including `brutalist` — update theme list (now 9 vendored) and mention Preview/print flow.~~ ✅ Done.
- ~~**PLAN.md §7** still references old stackoverflow/even/elegant themes — stale.~~ ✅ Done (also fixed stale theme refs in LOCAL_DEV + CONTRIBUTING).

### Known gaps / follow-ups
1. **Auth + public deploy** — the declared follow-up phase. Render service must stay local-only until then. *(Deferred — needs Cognito/infra decisions.)*
2. **PDF generation** — currently browser-print only; no in-app PDF export. *(Deferred — print flow documented in README; in-app export needs a new dependency decision.)*
3. ~~**Concurrent-edit protection** — last-write-wins; staleness check deferred.~~ ✅ Save-time staleness check added: store captures `loadedUpdatedAt`, `SaveButton` compares against live CMS `updatedAt` before executing ops.
4. **`basics.image` editing** — Image URL field added to Basics form (preview works immediately). Persisting it back to Keystone is still blocked: the CMS stores `image` as an Image *relation*, and the exact update-input shape (`{ create: { src } }` vs `{ connect: { id } }`) is unverified until `pnpm codegen` runs against live Keystone. `toCms.flattenBasics` documents this and keeps `image` excluded from mutation payloads.
5. **Save atomicity** — no transactions; ordered ops accepted risk. *(Accepted risk per PLAN §10.3.)*
6. ~~**Testing** — transformer has tests, but web app and render-service have none (`passWithNoTests`).~~ ✅ Added: render-service `postProcess.test.ts` (3 tests), web `validation/schema.test.ts` (6 tests). Both apps now run vitest for real.
7. ~~**ESLint/Prettier** — listed in tech stack but not confirmed configured this session.~~ ✅ Root flat `eslint.config.js` (typescript-eslint + react-hooks + react-refresh); `pnpm lint` runs clean (9 pre-existing warnings only). Prettier was already configured.
8. ~~**Production build of render-service** — dev runs via tsx; `tsc` build + Dockerfile for deploy not exercised.~~ ✅ `pnpm build` compiles; `dist/server.js` boots and serves `/health` + `/render`. Fixes: `start` script now preloads `dist/preload.js`; build copies `css-hook.mjs` to dist; Dockerfile CMD updated. Note: workspace packages (`@resume-studio/themes`) still resolve to TS sources, so prod runtime needs a TS loader (tsx) or those packages need real builds — flagged as follow-up.
