# Deployment Guide

How to deploy to **Northflank** as containers.

---

## Architecture

```
Browser
  ├── SPA (static files served by render-service)
  ├── /api/auth ──→ Render Service (proxies to Auth Service)
  └── POST /render ──→ Render Service (Fastify, port 5173)
                          │
                          └── Keystone CMS GraphQL (external, nt-keystone-cms)
Auth Service (port 4000) ──→ Postgres `auth` schema
```

One Docker image bundles the render-service (Fastify) + web SPA + auth-service.
The render-service serves the SPA from `/`, handles `POST /render`, and
proxies `/api/auth/*` to the in-image auth-service so the browser stays
single-origin.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Keystone CMS deployed | Must be accessible via public URL (e.g. `https://cms.example.com/api/graphql`) |
| Northflank-managed Postgres | Own database for auth (auth-service never touches Keystone's DB); `auth` schema applied via `apps/auth-service/migrations/auth-schema.sql` |
| Cognito app client allowing callback | `https://your-app.northflank.app/api/auth/callback/cognito` |
| Northflank account | With a project created |
| Git repo pushed | All apps and packages pushed to the same repo |

---

## Step 1: Create the Northflank service

1. Open the Northflank dashboard → your project
2. Click **New Service** → **Service** (needs port exposed for browser traffic)
3. Connect your Git repository
4. Configure the build:

| Setting | Value |
|---|---|
| Dockerfile path | `Dockerfile` (repo root) |
| Context directory | `/` (repo root) |
| Port | `5173` |

---

## Step 2: Set environment variables

### Build arguments (baked into client bundle at build time)

Set these in Northflank's **Build environment variables**:

```
VITE_GRAPHQL_ENDPOINT=https://your-cms.example.com/api/graphql
VITE_RENDER_ENDPOINT=https://your-app.northflank.app
```

| Variable | Purpose |
|---|---|
| `VITE_GRAPHQL_ENDPOINT` | Full URL to Keystone CMS GraphQL API |
| `VITE_RENDER_ENDPOINT` | Your app's public URL (same origin — browser POSTs to `{url}/render`) |

> These are `VITE_` prefixed so they're embedded in the client bundle at build time. Changing them requires a redeploy.

### Runtime environment variables

Set these in the **Environment** tab:

```
RENDER_PORT=5173
RENDER_HOST=0.0.0.0
RENDER_CORS_ORIGIN=https://your-app.northflank.app
AUTH_TARGET=http://127.0.0.1:4000
AUTH_URL=https://your-app.northflank.app
TRUSTED_ORIGINS=https://your-app.northflank.app
DATABASE_URL=postgres://user:password@db-host:5432/resume-auth
COGNITO_CLIENT_ID=...
COGNITO_CLIENT_SECRET=...
COGNITO_DOMAIN=...
COGNITO_REGION=...
COGNITO_USERPOOL_ID=...
BETTER_AUTH_SECRET=<openssl rand -base64 32>
```

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `RENDER_PORT` | No | `5173` | Port the Fastify server listens on |
| `RENDER_HOST` | No | `0.0.0.0` | Bind address (must be `0.0.0.0` for containers) |
| `RENDER_CORS_ORIGIN` | No | `http://localhost:5173` | Comma-separated allowed origins |
| `RENDER_ALLOWED_IPS` | No | (empty = public) | Comma-separated IPs to restrict access |
| `RENDER_CACHE_MAX` | No | `100` | LRU cache size for rendered output |
| `AUTH_TARGET` | No | unset | If set, render-service proxies `/api/auth` here (in-image: `http://127.0.0.1:4000`) |
| `AUTH_PORT` / `AUTH_HOST` | No | `4000` / `127.0.0.1` | Where the in-image auth-service listens |
| `AUTH_URL` | Yes | — | Public origin; drives OAuth callback + CORS |
| `TRUSTED_ORIGINS` | Yes | — | CORS allowlist for auth-service |
| `DATABASE_URL` | Yes | — | Postgres URL (no `options=` needed — the pool sets `search_path=auth`) |
| `COGNITO_*` | Yes | — | Cognito app client credentials |
| `BETTER_AUTH_SECRET` | Yes | — | Session signing secret (≥32 chars) |

---

## Step 3: Deploy

Click **Deploy**. Northflank builds the Docker image and starts the service.

### 3.0 One-time: create the auth schema

The container never runs migrations. Before first sign-in, apply the schema
to the auth Postgres:

```bash
psql "$DATABASE_URL" -f apps/auth-service/migrations/auth-schema.sql
```

`DATABASE_URL` must target the DB (schema `auth` is created by the script).
Without this every `/api/auth/*` call returns HTTP 500.

### 3.1 Verify

```bash
# Health check
curl https://your-app.northflank.app/health

# Web app
open https://your-app.northflank.app
```

### 3.2 Post-deploy: Update Keystone CMS CORS

Your Keystone CMS must allow requests from your Northflank app domain. Add the app URL to Keystone's CORS configuration (in the `nt-keystone-cms` repo).

---

## Step 4: Smoke test

| Check | What to look for |
|---|---|
| Editor loads | Resume data fetched from CMS via GraphQL |
| Form edits work | Changes reflected in local state |
| Preview renders | iframe shows styled resume from render service |
| Save disabled | App loads (sign-in works); no Save button — persistence is intentionally disabled (badge shows when signed in) |
| No console errors | CORS, network, or auth errors |

---

## Troubleshooting

### Preview iframe is blank or shows error
- Check `VITE_RENDER_ENDPOINT` is set correctly as a build arg in Northflank
- Check render service is healthy (`/health` endpoint)
- Check browser console for CORS errors — update `RENDER_CORS_ORIGIN`

### Build fails on Northflank
- Ensure Dockerfile context is `/` (repo root), not `apps/`
- Check that `VITE_GRAPHQL_ENDPOINT` and `VITE_RENDER_ENDPOINT` are set as build args
- Check Northflank build logs for missing dependencies

### GraphQL errors in the browser
- Verify `VITE_GRAPHQL_ENDPOINT` points to a running Keystone instance
- Check Keystone CORS allows your Northflank app domain
- Redeploy after changing `VITE_` env vars (they're baked in at build time)

### `[Better Auth]: Could not validate the database schema`
- Confirm the migration was applied: `psql "$DATABASE_URL" -c '\dn auth' -c '\dt auth.*'`
- The container never runs migrations — re-apply `apps/auth-service/migrations/auth-schema.sql` if the `auth` schema is missing
- If `DATABASE_URL` uses `sslmode=require`, note that `pg-connection-string` treats it as `verify-full`. Use the Northflank CA cert with `sslmode=verify-full&sslrootcert=...` instead of disabling verification

### Container restarts repeatedly
- `docker/entrypoint.sh` supervises both processes and exits non-zero with a `FATAL <name> exited` line naming whichever process died. Check for that line in the logs.
- `/health` only covers the render-service. A 200 from `/health` does not mean sign-in works, because the auth-service is reachable only through the in-image proxy.
- Check the container's exit reason in the Northflank dashboard. A clean exit 0 after a termination signal is a platform event (rollout, scale, resource limit), not an app crash.
