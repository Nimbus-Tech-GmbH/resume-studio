# Handoff Summary — Auth + Keystone Sync Complete

## What was done

Implemented user account synchronization between resume-studio (auth-service with Prisma DB) and Keystone CMS (separate Neon DB). When users sign in via Cognito:

1. **Auth-service** creates a user in the `auth` schema (Prisma.io pooled DB)
2. **signInUser callback** (in `apps/auth-service/src/auth.ts`) automatically:
   - Looks up Keystone user by email
   - Sets `Keystone.authId = resume-studio user ID`
3. **GraphQL queries** authorize access by checking `authId == session.user.id`
4. **Bulk migration** script available for existing Keystone users without authId

**Result:** Authenticated mode now works end-to-end. Sign-in → resume list loads → edit/preview/export work.

## Files changed

**Code (already committed):**
- `apps/auth-service/src/auth.ts` — added `signInUser` callback
- `apps/auth-service/src/scripts/migrate-keystone-users.ts` — bulk sync
- `apps/auth-service/package.json` — added `migrate:keystone-users` npm script
- Commits: `b966c7b`, `7a6c212`, `3b124fc` (auth-service repo history)

**Docs (just committed in main):**
- `resume-studio/README.md` — updated status, features, authenticated mode section
- `resume-studio/docs/ARCHITECTURE.md` — added §4a.1 "User sync (Keystone ↔ auth-service)"
- `resume-studio/docs/LOCAL_DEV.md` — added user sync section (automatic + bulk migration)
- `resume-studio/docs/README.md` — reorganized index, added KEYSTONE_USER_SYNC.md link
- Commit: `e3893a1`

**New reference doc:**
- `resume-studio/docs/KEYSTONE_USER_SYNC.md` — comprehensive guide (data model, end-to-end flow, troubleshooting)

## How to verify locally

```bash
# Start all services
pnpm dev

# Sign in at http://localhost:5173
# → redirects to Cognito
# → creates auth-service user
# → should load resume list and show startup dialog with resumes
```

**If startup dialog shows but no resumes load:**
```bash
# Bulk migrate existing Keystone users
pnpm --filter @resume-studio/auth-service migrate:keystone-users
```

Verify `Keystone.authId` was set. If still broken, check:
- `KEYSTONE_GRAPHQL_ENDPOINT` in `.env`
- Keystone CORS includes `http://localhost:5173` and `http://localhost:8787`
- Auth-service logs for sync errors

## Deployment checklist

On Northflank:
1. ✅ Auth-service DB created (Prisma.io with `auth` schema)
2. ✅ Migrations applied (`pnpm db:migrate:deploy`)
3. ✅ Cognito app client callback URL registered
4. ✅ `DATABASE_URL` / `DIRECT_URL` set (pooled + direct)
5. ✅ `KEYSTONE_GRAPHQL_ENDPOINT` or `VITE_GRAPHQL_ENDPOINT` set
6. ✅ Container env vars set (AUTH_URL, TRUSTED_ORIGINS, etc.)

**For production user migration:**
```bash
# SSH into container or run locally pointing at prod DBs
DATABASE_URL=<prod-pooled-url> \
KEYSTONE_GRAPHQL_ENDPOINT=https://your-cms.example.com/api/graphql \
pnpm --filter @resume-studio/auth-service migrate:keystone-users
```

## What's next

### Ready to implement:
- New resume creation → persist to CMS (currently local-only)
- Reorder persistence (emit `reorder` ops from `toCms`)
- Print-to-PDF via Puppeteer (currently browser Print dialog only)

### Known limitations (documented in KNOWN_ISSUES.md):
- Save is not atomic (mid-plan failure leaves partial updates, no rollback)
- Staleness check is advisory (concurrent edits detected but not merged)
- Local resumes (JSON import) cannot be saved to CMS
- Render service must stay localhost-only (no auth on `/render` endpoint)
- Reorder is UI-only (no `order` field in schema)

### Schema drift risk (S6):
- `schema.ts` and `schema.graphql` are static copies from Keystone
- Run `pnpm codegen` against live Keystone to regenerate types
- Missing schema fields cause silent data omission (awards/publications/references already happened once)

## Environment setup for next agent

Key files to know:
- `.env.example` — all required vars documented
- `resume-studio/AGENTS.md` — project rules and boundaries
- `docs/ARCHITECTURE.md §4a` — auth internals and callback flow
- `docs/KEYSTONE_USER_SYNC.md` — full user sync story with troubleshooting

No breaking changes. All prior work (transformer, save pipeline, validation) intact and tested.

---

**Deploy ready.** Commit and push to trigger Northflank build.
