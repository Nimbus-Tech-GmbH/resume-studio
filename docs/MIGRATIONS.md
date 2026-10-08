# Migrations Guide — Prisma Migrations for Better Auth Schema

How to create, apply, and manage database schema changes.

---

## Overview

**Approach:** Prisma 7 + SQL-first migrations.

Rationale:
- SQL migrations are explicit, auditable, version-controlled
- Prisma ORM 7 handles schema application via `prisma migrate deploy`
- Direct SQL (psql) remains the deployment mechanism for simplicity
- Prisma 7 requires `prisma.config.ts` at app root (breaking change from v6)

Benefits:
- Type-safe schema (validated by Prisma)
- Migration history (git tracks every change)
- Works across local dev → staging → prod
- Automatic handling of pooled vs direct connections
- Decoupled schema application from ORM (safer for CI/CD)

---

## Initial migration: 000_init

The first migration (`000_init`) captures the current Better Auth v1 schema.

**Location:** `apps/auth-service/prisma/migrations/000_init/migration.sql`

**Applies:**
- auth schema
- user table (id, name, email, emailVerified, image, createdAt, updatedAt)
- session table (id, expiresAt, token, createdAt, updatedAt, ipAddress, userAgent, userId)
- account table (id, accountId, providerId, userId, accessToken, refreshToken, idToken, accessTokenExpiresAt, refreshTokenExpiresAt, scope, password, createdAt, updatedAt)
- verification table (id, identifier, value, expiresAt, createdAt, updatedAt)

**When to apply:**
- New production database (before first app deploy)
- Local dev (first-time setup)
- CI/CD pipelines before tests

---

## Applying migrations

Migrations are stored as SQL files in `apps/auth-service/prisma/migrations/` and applied via `psql` or `prisma migrate deploy`.

### Using psql (recommended for production)

**Why psql?**
- Simple, explicit, no ORM layer
- Works in any environment (CI/CD, local, container)
- No Prisma runtime dependency
- Matches Keystone backend pattern (direct SQL in schema)

**Local development (Docker):**

```bash
psql "postgres://admin:dev-auth-pass@127.0.0.1:5434/resume-auth" \
  -f apps/auth-service/prisma/migrations/000_init/migration.sql
```

**Production (Prisma Postgres direct connection):**

```bash
DIRECT_URL="postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require" \
  psql "$DIRECT_URL" -f apps/auth-service/prisma/migrations/000_init/migration.sql
```

### Using Prisma CLI (alternative)

Prisma 7 now supports migrations via config file. This requires `prisma.config.ts` at the app root (new in Prisma 7).

**Local development:**

```bash
cd apps/auth-service
pnpm exec prisma migrate deploy
```

**Production:**

```bash
cd apps/auth-service
DIRECT_URL="postgres://..." pnpm exec prisma migrate deploy
```

> Use `DIRECT_URL` (direct connection), not `DATABASE_URL` (pooled). Prisma CLI needs direct access for introspection.

---

## Creating new migrations

### Step 1: Edit the schema

Edit `apps/auth-service/prisma/schema.prisma`:

```prisma
model NewTable {
  id String @id @default(cuid())
  name String
  createdAt DateTime @default(now())

  @@schema("auth")
}
```

### Step 2: Create migration via Prisma

```bash
cd apps/auth-service
# DATABASE_URL must point to local dev database
pnpm exec prisma migrate dev --name add_new_table
```

Prisma will:
1. Detect schema changes
2. Generate a migration file in `prisma/migrations/<timestamp>_add_new_table/migration.sql`
3. Ask if you want to reset the local database (for dev: usually yes)
4. Apply the migration
5. Regenerate Prisma Client

### Step 3: Review the generated SQL

Open `apps/auth-service/prisma/migrations/<timestamp>_add_new_table/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "auth"."new_table" ADD COLUMN "description" TEXT;
```

Edit if needed (but usually auto-generated SQL is correct).

### Step 4: Test locally

```bash
pnpm dev

# Your app should work with the new schema
```

### Step 5: Commit to git

```bash
git add apps/auth-service/prisma/migrations/<timestamp>_add_new_table/
git add apps/auth-service/prisma/schema.prisma
git commit -m "feat: add new_table to auth schema"
git push
```

### Step 6: Apply to production

Use psql (recommended) or Prisma CLI.

**Via psql:**

```bash
DIRECT_URL="<direct-url>" \
  psql "$DIRECT_URL" -f apps/auth-service/prisma/migrations/<timestamp>_add_new_table/migration.sql
```

**Via Prisma CLI:**

```bash
cd apps/auth-service
DIRECT_URL="<direct-url>" pnpm exec prisma migrate deploy

# Verify
pnpm exec prisma migrate status
```

---

## Migration file structure

Each migration directory contains:

```
prisma/migrations/<timestamp>_<name>/
├── migration.sql          # The SQL to apply
└── _migration_lock.toml   # Metadata (auto-generated, don't edit)
```

Example `migration.sql`:

```sql
-- CreateTable
CREATE TABLE "auth"."user" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "image" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "auth"."user"("email");
```

---

## Checking migration status

```bash
cd apps/auth-service
pnpm exec prisma migrate status
```

Output:

```
Migrations in database:
✔ 000_init

Pending migrations:
🔲 1698767890123_add_new_table
```

---

## Handling migration conflicts

### Scenario: Two developers create conflicting migrations

```
prisma/migrations/
├── 000_init/
├── 1698767890123_feature_a/       (dev A created)
└── 1698767890124_feature_b/       (dev B created, same timestamp)
```

**Resolution:**

1. **Rename one migration** to have a later timestamp:

```bash
cd apps/auth-service
mv prisma/migrations/1698767890123_feature_a prisma/migrations/1698767890125_feature_a
```

2. **Manually merge the SQL** if tables overlap, or keep separate if they don't

3. **Test locally:**

```bash
pnpm exec prisma migrate reset  # Wipes local DB and reapplies all
pnpm dev  # Verify app works
```

4. **Commit both with correct order:**

```bash
git add prisma/migrations/
git commit -m "merge: resolve migration conflicts"
```

---

## Resetting a local database

**Caution: This deletes all local data.**

```bash
cd apps/auth-service
pnpm exec prisma migrate reset

# Follow prompts; Prisma will:
# 1. Drop schema
# 2. Reapply all migrations from scratch
# 3. Regenerate Prisma Client
```

Use when:
- Local DB is corrupted
- You want a fresh start after merging conflicting migrations
- Debugging migration order issues

---

## Rollback strategy

Prisma doesn't have built-in rollback. Instead:

### Option 1: Add a new migration to undo changes

```bash
cd apps/auth-service
pnpm exec prisma migrate dev --name undo_bad_column

# Manually edit migration.sql to drop the column instead of adding it
# Apply: prisma migrate deploy
```

### Option 2: Manual SQL (if emergency)

```bash
# Connect directly and run SQL
psql "$DIRECT_URL" -c 'DROP COLUMN IF EXISTS "bad_column" FROM auth.user;'

# Regenerate Prisma Client
cd apps/auth-service
pnpm exec prisma generate
```

### Option 3: Restore from backup

Prisma Postgres keeps automatic backups. Restore from dashboard → restore to specific point in time.

---

## CI/CD integration

### GitHub Actions example

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Apply database migrations
        env:
          DIRECT_URL: ${{ secrets.DIRECT_URL }}
        run: |
          cd apps/auth-service
          pnpm exec prisma migrate deploy

      - name: Build and deploy
        run: |
          pnpm build
          # Deploy to Northflank, etc.
```

**Store secrets** in GitHub:
- `DIRECT_URL` — direct connection (for migrations)

---

## Debugging migration issues

### Migration hangs during deploy

**Cause:** `DATABASE_URL` is pooled; Prisma CLI needs `DIRECT_URL` for introspection.

**Fix:**

```bash
cd apps/auth-service
DIRECT_URL="postgres://..." pnpm exec prisma migrate deploy
```

### "Migration failed: syntax error"

**Cause:** Generated SQL has a typo or is incompatible with your DB version.

**Fix:**

1. Open `apps/auth-service/prisma/migrations/<timestamp>_<name>/migration.sql`
2. Review the SQL
3. Fix the syntax error
4. Delete migration and retry:

```bash
cd apps/auth-service
rm -rf prisma/migrations/<timestamp>_<name>
pnpm exec prisma migrate dev --name <name>
```

### "Cannot find module '@prisma/client' after migration"

**Cause:** Prisma Client wasn't regenerated after applying migrations.

**Fix:**

```bash
cd apps/auth-service
pnpm exec prisma generate
pnpm typecheck  # Verify types are correct
```

### "Schema does not exist: auth"

**Cause:** Migrations were never applied.

**Fix:**

```bash
cd apps/auth-service
pnpm exec prisma migrate deploy

# Verify
pnpm exec prisma migrate status
```

---

## Workflow summary

### For developers

1. **Edit schema** → `apps/auth-service/prisma/schema.prisma`
2. **Create migration** → `cd apps/auth-service && pnpm exec prisma migrate dev --name my_change`
3. **Test locally** → `pnpm dev`
4. **Commit** → push migration files
5. **Deploy** → migration applied via psql or prisma CLI

### For ops/deployment

1. **Before first deploy:** Apply migrations via psql or `prisma migrate deploy`
2. **Before each redeploy:** verify migrations are up-to-date
3. **If migration fails:** check logs, fix SQL, retry
4. **Backup before major migrations:** export DB snapshot

---

## Reference

| Command | Purpose |
|---|---|
| `prisma migrate dev --name <name>` | Create new migration + apply locally + regenerate client |
| `prisma migrate deploy` | Apply all pending migrations to target DB |
| `prisma migrate status` | Show migration status (applied, pending, failed) |
| `prisma migrate resolve --applied <name>` | Mark migration as applied without running SQL (for existing DBs) |
| `prisma migrate reset` | Drop all schema + reapply migrations (local dev only) |
| `prisma generate` | Regenerate Prisma Client after manual SQL changes |

---

## Files

- **`apps/auth-service/prisma/schema.prisma`** — Schema definition (source of truth)
- **`apps/auth-service/prisma.config.ts`** — Prisma config (Prisma 7+)
- **`apps/auth-service/prisma/migrations/`** — Migration history (git-tracked)
- **`apps/auth-service/src/db.ts`** — Prisma Client singleton
- **`.env`, `.env.local`** — `DATABASE_URL` + `DIRECT_URL`

---

## More info

- [Prisma migrate docs](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate)
- [Prisma schema reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Prisma 7 upgrade guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7)
- [Better Auth docs](https://www.better-auth.com)
