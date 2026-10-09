# Keystone User Migration to Auth-Service DB

## Problem

After Cognito sign-in, authenticated users' sessions exist in the **resume-studio auth DB** (`auth` schema), but they may not have corresponding records in the **Keystone CMS DB**. This breaks GraphQL queries because Keystone can't find the user to authorize resume access.

## Solution

Two-part sync strategy:

### 1. **Automatic Sync (New Users)**

When a user signs in via Cognito, the auth-service's `signInUser` callback fires automatically and:
1. Checks if the user exists in Keystone by `authId`
2. If not, creates a new Keystone user with `authId = resume-studio user ID`
3. Logs the sync result

**No action needed** — this happens for all Cognito sign-ups going forward.

### 2. **Bulk Migration (Existing Users)**

For users who existed in Keystone before Cognito integration:

```bash
pnpm --filter @resume-studio/auth-service migrate:keystone-users
```

This script:
- Fetches all Keystone users
- For each user **without** an `authId`:
  - Creates a matching user in the auth-service DB
  - Updates the Keystone record with `authId` pointing to the new user ID
- Skips users who already have an `authId`

## Requirements

### Environment Variables

- `DATABASE_URL` — resume-studio auth DB connection string (required)
- `KEYSTONE_GRAPHQL_ENDPOINT` **or** `VITE_GRAPHQL_ENDPOINT` — Keystone GraphQL endpoint
  - Local: `http://localhost:3000/api/graphql`
  - Prod: `https://your-cms.example.com/api/graphql`

### Database Access

- Auth-service DB must be reachable (queries the auth schema)
- Keystone GraphQL must be reachable (queries users + updates authId)

## How It Works

**Resume-studio auth DB schema (Prisma 7):**
```sql
CREATE SCHEMA auth;
CREATE TABLE auth.user (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  ...
);
```

**Keystone CMS schema:**
```sql
CREATE TABLE "User" (
  id SERIAL PRIMARY KEY,
  authId TEXT UNIQUE,  -- Links to auth.user.id
  email TEXT UNIQUE,
  name TEXT,
  ...
);
```

**Flow:**
1. Cognito user signs in → auth-service creates `auth.user` record ✓
2. `signInUser` callback fires → creates `public."User"` record with `authId` ✓
3. GraphQL query checks `User.authId` against session's user ID ✓
4. Query succeeds, user can load/edit resumes ✓

## Testing Locally

```bash
# Start auth-service, Keystone, web
pnpm dev

# Sign in via Cognito
# Visit http://localhost:5173

# In another terminal, check migration
pnpm --filter @resume-studio/auth-service migrate:keystone-users
```

Expected output:
```
[migrate] Found N Keystone users
[migrate] SKIP user@example.com (already has authId: xxx)
```

If users don't have `authId`, they'll be created and linked.

## Production Deployment

1. Push code with auth sync callbacks (already in main: commit `b966c7b`)
2. Redeploy auth-service to Northflank
3. (Optional) Run bulk migration for existing Keystone users:
   ```bash
   # via CI/CD or manual SSH to Northflank pod
   pnpm --filter @resume-studio/auth-service migrate:keystone-users
   ```

## Troubleshooting

**Migration fails with "Keystone unreachable"**
- Check `KEYSTONE_GRAPHQL_ENDPOINT` is set and reachable
- Verify Keystone is running
- Check network/firewall between containers

**Migration fails with "Failed to connect to resume-studio DB"**
- Verify `DATABASE_URL` is correct and reachable
- Check auth schema exists (should be created by Prisma migrations)

**User has authId but still can't load resumes**
- Check that the `authId` value matches the session user's ID
- Verify Keystone's GraphQL access control isn't blocking the user
- Check resume ownership is correctly linked to the user

## Implementation Details

**Files modified:**
- `apps/auth-service/src/auth.ts` — Added `signUpUser` and `signInUser` callbacks
- `apps/auth-service/scripts/migrate-keystone-users.ts` — Bulk migration script
- `apps/auth-service/package.json` — Added `migrate:keystone-users` npm script

**Commits:**
- `b966c7b` — feat(auth): sync Cognito users to Keystone CMS on sign-in
- `7a6c212` — feat(auth): add Keystone user migration script
