# Northflank Deployment Guide

Complete walkthrough for deploying resume-studio to Northflank with Prisma Postgres.

---

## Prerequisites

| Item | Notes |
|---|---|
| Keystone CMS deployed | Public URL e.g. `https://cms.example.com/api/graphql` |
| Prisma Postgres DB created | [dashboard.prisma.io](https://dashboard.prisma.io) — grab pooled + direct URLs |
| Cognito app client configured | Callback URL: `https://your-app.northflank.app/api/auth/callback/cognito` |
| Northflank account + project | Existing project to deploy into |
| GitHub/GitLab repo pushed | resume-studio repo with all commits |

---

## Step 1: Prepare the database

### 1.1 Get connection URLs

Go to [dashboard.prisma.io](https://dashboard.prisma.io) → your project → **Connection**:

```
DATABASE_URL (pooled):  postgres://USER:PASSWORD@pooled.db.prisma.io:5432/postgres?sslmode=require
DIRECT_URL (direct):    postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require
```

### 1.2 Apply migrations

Before deploying, apply the auth schema migration using psql or Prisma CLI:

**Via psql (recommended):**

```bash
psql "postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require" \
  -f apps/auth-service/prisma/migrations/000_init/migration.sql
```

**Via Prisma CLI:**

```bash
cd apps/auth-service
DIRECT_URL="postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require" \
  pnpm exec prisma migrate deploy
```

> Use `DIRECT_URL` (direct connection), not `DATABASE_URL` (pooled). Prisma CLI requires direct access for introspection.

### 1.3 Verify

```bash
DIRECT_URL="postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require" \
  psql "$DIRECT_URL" -c '\dn auth' -c '\dt auth.*'
```

Should show:

```
Schema auth, tables: user, session, account, verification
```

**If you skip this step, every `/api/auth/*` call will return HTTP 500 after deployment.**

---

## Step 2: Create Northflank service

### 2.1 New service

1. Log in to Northflank → your project
2. **Create** → **Service**
3. Select **Docker** (not Runtime)
4. Connect your GitHub/GitLab repo

### 2.2 Build settings

| Setting | Value |
|---|---|
| Dockerfile | `Dockerfile` |
| Context | `/` |
| Build timeout | 20 min (default OK) |

### 2.3 Service settings

| Setting | Value |
|---|---|
| Port | `5173` |
| Health check path | `/health` |
| Health check interval | `30s` |

---

## Step 3: Set environment variables

### 3.1 Build environment

In Northflank → your service → **Build** tab → **Environment variables**:

```
VITE_GRAPHQL_ENDPOINT=https://your-cms.example.com/api/graphql
VITE_RENDER_ENDPOINT=https://your-app.northflank.app
```

> These are baked into the client bundle at build time. Changing them requires a rebuild.

### 3.2 Runtime environment

In Northflank → your service → **Deployment** tab → **Environment variables**:

```
# Render service (static + /render endpoint)
RENDER_PORT=5173
RENDER_HOST=0.0.0.0
RENDER_CORS_ORIGIN=https://your-app.northflank.app
RENDER_CACHE_MAX=100

# Auth service
AUTH_PORT=4000
AUTH_HOST=127.0.0.1
AUTH_URL=https://your-app.northflank.app
TRUSTED_ORIGINS=https://your-app.northflank.app

# Database (Prisma Postgres)
DATABASE_URL=postgres://USER:PASSWORD@pooled.db.prisma.io:5432/postgres?sslmode=require
DIRECT_URL=postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require

# Cognito
COGNITO_CLIENT_ID=your_client_id
COGNITO_CLIENT_SECRET=your_client_secret
COGNITO_DOMAIN=eu-central-1xyz.auth.eu-central-1.amazoncognito.com
COGNITO_REGION=eu-central-1
COGNITO_USERPOOL_ID=eu-central-1_ABC123DEF

# Better Auth secret (generate: openssl rand -base64 32)
BETTER_AUTH_SECRET=your_32_char_secret_here
```

**Do NOT commit `.env` to git.** Northflank injects these at runtime.

---

## Step 4: Deploy

### 4.1 Trigger build

Click **Deploy** in Northflank. The build starts:

1. Installs pnpm dependencies
2. Generates Prisma Client (uses `DATABASE_URL` for introspection if needed)
3. Runs `pnpm build` (TypeScript → JS)
4. Builds Docker image
5. Pushes to Northflank registry

**Build time:** ~5-10 minutes

### 4.2 Monitor the build

Check the **Build logs** tab. Watch for:

- `pnpm install` — dependencies
- `pnpm generate` — Prisma Client generation
- `pnpm build` — app compilation
- `STEP N/X — Docker build` — container assembly
- No errors in TypeScript compilation

**Common build failures:**

| Error | Fix |
|---|---|
| `Cannot find module '@prisma/client'` | Ensure `pnpm install` ran; check lockfile in git |
| `DATABASE_URL not set` | Set it in **Build environment**; rebuild |
| `VITE_GRAPHQL_ENDPOINT not set` | Add to **Build environment**; rebuild |
| `docker: invalid reference format` | Usually transient; retry deploy |

### 4.3 Container startup

Once image builds, Northflank starts the container:

1. Entrypoint: `docker/entrypoint.sh` (supervises render-service + auth-service)
2. Render service listens on `:5173` → exposed publicly
3. Auth service listens on `127.0.0.1:4000` → only accessible via render-service proxy

**Startup time:** ~30 seconds

Check the **Logs** tab for:

```
auth boot {port: 4000, host: 127.0.0.1}
Server listening at http://127.0.0.1:4000
auth-service on http://127.0.0.1:4000
✓ Render service on http://0.0.0.0:5173
```

If you see `[Better Auth]: Could not validate the database schema`, **the auth schema was not applied** (see Step 1.2).

---

## Step 5: Verify deployment

### 5.1 Health check

```bash
curl https://your-app.northflank.app/health
# Expected: {"ok":true}
```

### 5.2 App loads

```bash
open https://your-app.northflank.app
```

You should see the resume editor. No auth errors in browser console (check DevTools).

### 5.3 Sign in (optional)

Click the user icon → **Sign in**. You'll be redirected to Cognito hosted UI. After sign-in, you should be able to load/edit resumes from Keystone CMS.

**If sign-in fails:**

- Check Cognito app client allows callback: `https://your-app.northflank.app/api/auth/callback/cognito`
- Check browser console for auth error (likely CORS mismatch)
- Verify `TRUSTED_ORIGINS` in Northflank includes your app domain

### 5.4 Render service

```bash
curl -X POST https://your-app.northflank.app/render \
  -H 'Content-Type: application/json' \
  -d '{"template":"classic",...}'
# Expected: rendered HTML or error
```

---

## Step 6: Post-deploy checklist

| Check | Action |
|---|---|
| Health endpoint | `curl https://your-app.northflank.app/health` → 200 |
| SPA loads | No 404, no red error banner |
| No GraphQL errors | Browser console clean (or expected errors if no resume exists) |
| Sign-in works | Cognito flow completes, user badge shows |
| Render works | Edit → Preview renders in iframe |
| No auth 500 | If `/api/auth/*` returns 500, schema missing (re-run Step 1.2) |

---

## Updating the app

### Push code changes

```bash
git add .
git commit -m "your message"
git push origin main
```

### Redeploy

In Northflank:

1. Go to **Deployments** tab
2. Click **Deploy** (or enable auto-deploy from git webhook)

The container rebuilds and restarts. **Old data is not lost** — Postgres persists on the managed DB.

### Changing build-time vars

If you update `VITE_GRAPHQL_ENDPOINT` or `VITE_RENDER_ENDPOINT`:

1. Update **Build environment** in Northflank
2. Click **Deploy** (full rebuild required)

> These are baked into the client bundle, so changing them without rebuild has no effect.

### Changing runtime vars

If you update `DATABASE_URL`, `COGNITO_CLIENT_SECRET`, etc.:

1. Update **Environment variables** in Northflank
2. Container restarts automatically (no rebuild needed)

---

## Troubleshooting

### Preview iframe is blank

```
Check:
- VITE_RENDER_ENDPOINT is set as build arg
- Render service is healthy (/health → 200)
- Browser console has CORS error → update RENDER_CORS_ORIGIN
```

### "Could not validate the database schema"

```
The auth schema was never applied.

Fix:
1. Run Step 1.2 again (psql or prisma migrate deploy)
2. Verify: psql -c '\dt auth.*'
3. Restart container (click Restart in Northflank)
```

### "Keystone unreachable"

```
Check:
- VITE_GRAPHQL_ENDPOINT is a reachable URL (https://your-cms.example.com/api/graphql)
- Keystone CORS allows your Northflank app domain
```

### "Invalid OAuth client"

```
Check:
- COGNITO_CLIENT_ID, COGNITO_CLIENT_SECRET are correct
- Cognito app client callback allows https://your-app.northflank.app/api/auth/callback/cognito
- COGNITO_DOMAIN, COGNITO_REGION, COGNITO_USERPOOL_ID are correct
```

### Container keeps restarting

```
Check Northflank logs for:
- "FATAL render-service exited" — render service crashed
- "FATAL auth-service exited" — auth service crashed (often schema missing)
- "psql: error..." — database unreachable

Most common: auth schema not applied (Step 1.2) or DATABASE_URL is wrong.
```

### Build fails with "pnpm install" error

```
Usually transient. Retry deploy. If persistent:
- Check lockfile is in git (pnpm-lock.yaml)
- Check all workspace packages have package.json
- Check Node version: Dockerfile uses node:20-alpine (OK for 20.19+)
```

---

## Scaling & Performance

### Render service

- Stateless (only in-memory LRU cache)
- Can be scaled horizontally in Northflank (multiple replicas)
- Scales well with load

### Auth service

- Stateful (stores session cookies in Postgres)
- Keep single instance (Northflank default)
- Postgres connection pool handles concurrent requests

### Database

- Prisma Postgres is managed by Prisma
- Monitor disk/connections in dashboard.prisma.io
- Backup is automatic (check Prisma docs for schedule)

---

## Reference: Full env var table

| Variable | Scope | Required | Default | Example |
|---|---|---|---|---|
| `VITE_GRAPHQL_ENDPOINT` | Build | Yes | — | `https://cms.example.com/api/graphql` |
| `VITE_RENDER_ENDPOINT` | Build | Yes | — | `https://your-app.northflank.app` |
| `RENDER_PORT` | Runtime | No | `5173` | `5173` |
| `RENDER_HOST` | Runtime | No | `0.0.0.0` | `0.0.0.0` |
| `RENDER_CORS_ORIGIN` | Runtime | No | `http://localhost:5173` | `https://your-app.northflank.app` |
| `RENDER_CACHE_MAX` | Runtime | No | `100` | `200` |
| `AUTH_PORT` | Runtime | No | `4000` | `4000` |
| `AUTH_HOST` | Runtime | No | `127.0.0.1` | `127.0.0.1` |
| `AUTH_URL` | Runtime | Yes | — | `https://your-app.northflank.app` |
| `TRUSTED_ORIGINS` | Runtime | Yes | — | `https://your-app.northflank.app` |
| `DATABASE_URL` | Runtime | Yes | — | `postgres://...@pooled.db.prisma.io...` |
| `DIRECT_URL` | Runtime | No* | — | `postgres://...@db.prisma.io...` |
| `COGNITO_CLIENT_ID` | Runtime | Yes | — | (from Cognito console) |
| `COGNITO_CLIENT_SECRET` | Runtime | Yes | — | (from Cognito console) |
| `COGNITO_DOMAIN` | Runtime | Yes | — | `eu-central-1xyz.auth.eu-central-1.amazoncognito.com` |
| `COGNITO_REGION` | Runtime | Yes | — | `eu-central-1` |
| `COGNITO_USERPOOL_ID` | Runtime | Yes | — | `eu-central-1_ABC123DEF` |
| `BETTER_AUTH_SECRET` | Runtime | Yes | — | (≥32 chars, `openssl rand -base64 32`) |

*`DIRECT_URL` only needed if `DATABASE_URL` is pooled (e.g., Prisma Postgres). Omit for direct connections.

---

## Schema migration on production

**The container never runs migrations.** Schema must be applied before first deploy (see Step 1.2).

If you need to update the schema later:

1. Edit `apps/auth-service/prisma/schema.prisma` (add new models/fields)
2. Create a migration:

```bash
cd apps/auth-service
pnpm exec prisma migrate dev --name my_change
```

3. Review the generated SQL in `apps/auth-service/prisma/migrations/<timestamp>_my_change/migration.sql`
4. Commit & push
5. Apply to prod via psql or Prisma CLI:

```bash
cd apps/auth-service
DIRECT_URL="<direct-url>" pnpm exec prisma migrate deploy
```

6. Redeploy (container restarts, picks up new Prisma Client)

---

## Disaster recovery

### Database backup

Prisma Postgres handles automatic backups. Check [dashboard.prisma.io](https://dashboard.prisma.io) → Backups tab.

To restore:

1. Create new Prisma Postgres database
2. Download backup
3. Import via Prisma dashboard
4. Update `DATABASE_URL` + `DIRECT_URL` in Northflank
5. Restart container

### Rollback to previous version

Northflank keeps build history. Click **Deployments** → previous build → **Revert**. Container restarts with old code.

**Data is preserved** — only the code image changes.

---

## Additional resources

- [Prisma Postgres docs](https://www.prisma.io/postgres)
- [Northflank docs](https://northflank.com/docs)
- [Better Auth docs](https://www.better-auth.com)
- [Cognito app client setup](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-client.html)
- [Prisma 7 upgrade guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7)
