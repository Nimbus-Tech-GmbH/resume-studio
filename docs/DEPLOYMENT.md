# Deployment Guide

How to deploy to **Northflank** as a single container.

---

## Architecture

```
Browser
  ├── SPA (static files served by render-service)
  └── POST /render ──→ Render Service (Fastify, port 5173)
                            │
                            └── Keystone CMS GraphQL (external, nt-keystone-cms)
```

One Docker image bundles the render-service (Fastify) and the web SPA (static files). The render-service serves the SPA from `/` and handles `POST /render` for theme rendering.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Keystone CMS deployed | Must be accessible via public URL (e.g. `https://cms.example.com/api/graphql`) |
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
```

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `RENDER_PORT` | No | `5173` | Port the Fastify server listens on |
| `RENDER_HOST` | No | `0.0.0.0` | Bind address (must be `0.0.0.0` for containers) |
| `RENDER_CORS_ORIGIN` | No | `http://localhost:5173` | Comma-separated allowed origins |
| `RENDER_ALLOWED_IPS` | No | (empty = public) | Comma-separated IPs to restrict access |
| `RENDER_CACHE_MAX` | No | `100` | LRU cache size for rendered output |

---

## Step 3: Deploy

Click **Deploy**. Northflank builds the Docker image and starts the service.

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
| Save works | Changes persist to CMS (check after reload) |
| No console errors | CORS, network, or auth errors |

---

## Environment variable reference

### Build-time (Vite)

| Variable | Required | Example |
|---|---|---|
| `VITE_GRAPHQL_ENDPOINT` | Yes | `https://cms.example.com/api/graphql` |
| `VITE_RENDER_ENDPOINT` | Yes | `https://app.northflank.app` |

### Runtime (Node.js)

| Variable | Required | Default | Example |
|---|---|---|---|
| `RENDER_PORT` | No | `5173` | `5173` |
| `RENDER_HOST` | No | `0.0.0.0` | `0.0.0.0` |
| `RENDER_ALLOWED_IPS` | No | (empty) | `0.0.0.0,::,::1` |
| `RENDER_CORS_ORIGIN` | No | `http://localhost:5173` | `https://app.northflank.app` |
| `RENDER_CACHE_MAX` | No | `100` | `200` |

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
