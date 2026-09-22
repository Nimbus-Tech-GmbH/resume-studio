# Deployment Guide

How to deploy the web app to **Vercel** and the render service to **Northflank**.

---

## Architecture (reminder)

```
Browser (Vercel)  ──→  Keystone CMS (external)
       │
       └──POST /render──→  Render Service (Northflank, port 8787)
```

The web app and render service are deployed independently. The CMS is a separate repo (`nt-keystone-cms`) and must be deployed separately as well.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Keystone CMS deployed | Must be accessible via public URL (e.g. `https://cms.example.com/api/graphql`) |
| Northflank account | With a project created |
| Vercel account | Linked to your Git provider |
| Git repo pushed | Both apps and packages pushed to the same repo |

---

## Step 1: Deploy the Render Service (Northflank)

### 1.1 Create the service

1. Open the Northflank dashboard → your project
2. Click **New Service** → **Worker** (or **Service** if you need the port exposed externally)
3. Connect your Git repository
4. Configure the build:

| Setting | Value |
|---|---|
| Dockerfile path | `apps/render-service/Dockerfile` |
| Context directory | `/` (repo root) |
| Port | `8787` |

> **Why context root?** The Dockerfile copies `pnpm-workspace.yaml` and `packages/` from the repo root. Using `apps/render-service` as context would break the build.

### 1.2 Set environment variables

Add these in the **Environment** tab:

```
RENDER_PORT=8787
RENDER_HOST=0.0.0.0
RENDER_ALLOWED_IPS=0.0.0.0,::,::1
RENDER_CORS_ORIGIN=https://your-vercel-app.vercel.app
RENDER_CACHE_MAX=100
```

| Variable | Purpose |
|---|---|
| `RENDER_PORT` | Port the Fastify server listens on |
| `RENDER_HOST` | Must be `0.0.0.0` (not `127.0.0.1`) for container routing |
| `RENDER_ALLOWED_IPS` | IP allowlist. Open it up or restrict to Vercel IPs |
| `RENDER_CORS_ORIGIN` | Your Vercel app URL — required for browser requests |
| `RENDER_CACHE_MAX` | LRU cache size for rendered output |

### 1.3 Deploy

Click **Deploy**. Northflank builds the Docker image and starts the service.

Once healthy, note the service URL (e.g. `https://your-service.northflank.app`). You'll need it for the web app.

### 1.4 Verify

```bash
curl https://your-service.northflank.app/health
# Should return 200 or similar
```

---

## Step 2: Deploy the Web App (Vercel)

### 2.1 Create the project

1. Open the Vercel dashboard → **Add New Project**
2. Import your Git repository
3. Configure:

| Setting | Value |
|---|---|
| Framework Preset | Vite |
| Root Directory | `apps/web` |
| Build Command | `cd ../.. && pnpm --filter @resume-studio/web build` |
| Output Directory | `dist` |
| Install Command | `cd ../.. && pnpm install` |

> **Why `cd ../..`?** Vercel runs commands from the project root. This is a pnpm monorepo, so install must happen at the root, and the build must be invoked with `--filter`.

### 2.2 Set environment variables

Add these in the **Settings → Environment Variables** tab:

```
VITE_GRAPHQL_ENDPOINT=https://your-keystone-cms.vercel.app/api/graphql
VITE_RENDER_ENDPOINT=https://your-service.northflank.app
```

| Variable | Purpose |
|---|---|
| `VITE_GRAPHQL_ENDPOINT` | Full URL to Keystone CMS GraphQL API |
| `VITE_RENDER_ENDPOINT` | URL to the Northflank render service (no trailing slash) |

> These are `VITE_` prefixed so they're embedded in the client bundle at build time. Changing them requires a redeploy.

### 2.3 Deploy

Click **Deploy**. Vercel builds the static SPA and deploys it.

### 2.4 Verify

1. Open your Vercel app URL
2. Pick or create a resume
3. The preview iframe should render (calls the Northflank render service)
4. Check the browser console for CORS or network errors

---

## Step 3: Post-deploy configuration

### 3.1 Update CORS on Northflank

After the Vercel deploy, update `RENDER_CORS_ORIGIN` in Northflank to your actual Vercel URL:

```
RENDER_CORS_ORIGIN=https://your-actual-vercel-app.vercel.app
```

Trigger a redeploy in Northflank.

### 3.2 Update Keystone CMS CORS

Your Keystone CMS must allow requests from your Vercel domain. Add the Vercel URL to Keystone's CORS configuration (in the separate CMS repo).

### 3.3 Lock down render service IPs (optional)

If you want only Vercel to reach the render service, restrict `RENDER_ALLOWED_IPS` to [Vercel's outbound IPs](https://vercel.com/docs/edge-network/ips). Note: Vercel's IPs can change, so this requires maintenance.

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

## Known limitations

| Issue | Impact | Status |
|---|---|---|
| **A6: No auth on render service** | Anyone with the URL can render arbitrary payloads | Blocked on auth phase |
| **A5: TS sources in workspace packages** | Docker build works but relies on `tsx` at runtime | Known, works but not ideal |
| **Non-atomic saves (A1)** | If one mutation fails mid-save, partial data may persist | Documented risk |

---

## Environment variable reference

### Web app (Vite)

| Variable | Required | Example |
|---|---|---|
| `VITE_GRAPHQL_ENDPOINT` | Yes | `https://cms.example.com/api/graphql` |
| `VITE_RENDER_ENDPOINT` | Yes | `https://render.northflank.app` |

### Render service (Node.js)

| Variable | Required | Default | Example |
|---|---|---|---|
| `RENDER_PORT` | No | `8787` | `8787` |
| `RENDER_HOST` | No | `127.0.0.1` | `0.0.0.0` |
| `RENDER_ALLOWED_IPS` | No | `127.0.0.1,::1` | `0.0.0.0,::,::1` |
| `RENDER_CORS_ORIGIN` | No | `*` | `https://app.vercel.app` |
| `RENDER_CACHE_MAX` | No | `100` | `200` |

---

## Troubleshooting

### Preview iframe is blank or shows error
- Check `VITE_RENDER_ENDPOINT` is set correctly in Vercel
- Check Northflank service is healthy and responding
- Check browser console for CORS errors — update `RENDER_CORS_ORIGIN` in Northflank

### Build fails on Vercel
- Ensure install command is `cd ../.. && pnpm install` (monorepo root)
- Ensure build command is `cd ../.. && pnpm --filter @resume-studio/web build`
- Check Vercel build logs for missing dependencies

### Build fails on Northflank
- Ensure Dockerfile context is `/` (repo root), not `apps/render-service`
- Check that `pnpm-workspace.yaml` and `packages/` are included in the repo

### GraphQL errors in the browser
- Verify `VITE_GRAPHQL_ENDPOINT` points to a running Keystone instance
- Check Keystone CORS allows your Vercel domain
- Redeploy Vercel after changing `VITE_` env vars (they're baked in at build time)
