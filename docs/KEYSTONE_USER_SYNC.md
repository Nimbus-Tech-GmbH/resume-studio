# Keystone User Sync: Linking Auth Databases

## Problem

Resume-studio and Keystone CMS use **two separate databases**:

| Database | Provider | Schema | Users |
|----------|----------|--------|-------|
| **Keystone CMS** | Neon | `public."User"` | ✓ Existing users |
| **Resume-studio** | Prisma.io | `auth` schema | ✓ Created on Cognito sign-in |

When a Keystone user signs in via Cognito, a new session is created in resume-studio's auth DB. But **Keystone has no way to know this user is authenticated** because the two user records are disconnected. GraphQL queries fail because Keystone can't authorize access to the user's resumes.

## Solution

**Link the two databases via `authId`:**

```
Keystone User (Neon)
├── id: 1
├── email: "user@example.com"
├── name: "John Doe"
└── authId: "xyz-123"  ← Points to resume-studio user

Auth User (Prisma.io)
├── id: "xyz-123"  ← Referenced by Keystone
├── email: "user@example.com"
├── name: "John Doe"
└── ... (Better Auth session data)
```

### How It Works

1. **Cognito sign-in** → Auth-service creates user in `auth.user` table
2. **Sync callback fires** → Finds Keystone user by email
3. **Updates Keystone** → Sets `authId = resume-studio user ID`
4. **GraphQL queries** → Can now authorize against `authId`

### Two Approaches

#### **A. Automatic (New Sign-ups)**

When a Cognito user signs in, the auth-service's `signInUser` callback automatically:
1. Checks if they have an existing Keystone record by email
2. If yes, updates Keystone `authId` to point to the new auth-service user
3. If no, logs a warning (user doesn't exist in Keystone yet)

**No action needed** — happens for all Cognito sign-ins.

#### **B. Bulk Migration (Existing Users)**

For Keystone users created before Cognito integration, run:

```bash
pnpm --filter @resume-studio/auth-service migrate:keystone-users
```

The script:
1. Fetches all Keystone users
2. For each user **without** an `authId`:
   - Creates a new user in the auth-service DB
   - Updates the Keystone record with `authId = new auth-service user ID`
3. Skips users who already have an `authId`

## Requirements

### Environment Variables

- `DATABASE_URL` — Resume-studio auth-service DB (Prisma.io, required)
- `KEYSTONE_GRAPHQL_ENDPOINT` **or** `VITE_GRAPHQL_ENDPOINT` — Keystone GraphQL
  - Local: `http://localhost:3000/api/graphql`
  - Prod: `https://your-cms.example.com/api/graphql`

### Database Access

- Auth-service DB must be reachable (creates users in `auth` schema)
- Keystone GraphQL must be reachable (queries by email + updates `authId`)

## Data Model

### Keystone CMS (`public."User"`)
```sql
CREATE TABLE "User" (
  id SERIAL PRIMARY KEY,
  authId TEXT UNIQUE DEFAULT '',          -- Links to auth-service user ID
  name TEXT DEFAULT '',
  email TEXT UNIQUE,
  password TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  userGroup TEXT DEFAULT ''
);
```

### Resume-studio Auth (`auth.user`)
```sql
CREATE TABLE auth.user (
  id TEXT PRIMARY KEY,                    -- Referenced by Keystone.authId
  email TEXT UNIQUE,
  name TEXT,
  emailVerified BOOLEAN DEFAULT FALSE,
  image TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP
);
```

## Testing Locally

```bash
# Start Keystone, auth-service, web
pnpm dev

# Sign in with Cognito
# Visit http://localhost:5173, click "Sign In"

# Verify sync in another terminal
pnpm --filter @resume-studio/auth-service migrate:keystone-users
```

Expected output (if user already synced):
```
[migrate] Found 1 Keystone users
[migrate] SKIP user@example.com (already linked to authId: xxx-yyy-zzz)
```

## Sign-in Flow (End-to-End)

```
1. User visits app → auth-service checks session
                  ↓
2. No session → redirect to Cognito
                  ↓
3. Cognito OAuth callback → auth-service receives token
                  ↓
4. Create auth-service user in auth.user
                  ↓
5. signInUser callback fires
   - Lookup Keystone user by email
   - Update Keystone.authId = auth-service user ID
                  ↓
6. Browser redirected back to app with session cookie
                  ↓
7. useSession() hook reads session
   - session.user.id = auth-service user ID
   - useAuth() marks isAuthenticated = true
                  ↓
8. Web app fetches resumes via GraphQL
   - GraphQL middleware checks Keystone.authId == session.user.id
   - User authorized → resumes loaded ✓
```

## Troubleshooting

**"User already has authId" in logs**
- User was already synced (expected after first sign-in)
- Safe to ignore

**Sign-in completes but startup dialog shows (user not authenticated)**
- Check auth-service logs for sync errors:
  ```bash
  # In Northflank or local logs
  grep "\[auth\]" logs
  ```
- Verify Keystone user exists for that email
- Check that `authId` was actually updated in Keystone

**"Keystone user not found by email"**
- Cognito user is new (not in Keystone yet)
- User must be manually created in Keystone admin UI first, or
- Admin can create via GraphQL mutation before user signs in

**Migration fails "Keystone unreachable"**
- Verify `KEYSTONE_GRAPHQL_ENDPOINT` is set correctly
- Check Keystone is running and accessible
- Test: `curl -X POST $KEYSTONE_GRAPHQL_ENDPOINT -d '{"query":"{ __typename }"}'`

**Migration fails "Database connection refused"**
- Verify `DATABASE_URL` points to auth-service DB
- Check Prisma.io connection pool is running
- Verify credentials in `.env`

## Implementation

**Files modified:**
- `apps/auth-service/src/auth.ts` — Added `signInUser` callback to link Keystone users
- `apps/auth-service/scripts/migrate-keystone-users.ts` — Bulk migration script
- `apps/auth-service/package.json` — Added `migrate:keystone-users` npm script

**Commits:**
- `b966c7b` — feat(auth): sync Cognito users to Keystone CMS on sign-in
- `7a6c212` — feat(auth): add Keystone user migration script
- `3b124fc` — fix(auth): correct Keystone user sync logic — link by email, not create
