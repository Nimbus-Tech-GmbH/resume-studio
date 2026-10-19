# Deployment Guide (Northflank)

Deploy as a containerized service using the repo root `Dockerfile`.

This app runs as a bundled runtime where render-service serves the SPA and
proxies `/api/auth/*` to the in-image auth-service.

---

## Prerequisites

- Public Keystone CMS GraphQL endpoint
- Auth Postgres database (separate from Keystone DB)
- Cognito app client with callback:
  - `https://<your-app>/api/auth/callback/cognito`
- Northflank project + connected repository

---

## 1) Create service

Northflank → New Service → connect repo.

Build config:
- Dockerfile path: `Dockerfile`
- Context: repo root
- Exposed port: `5173`

---

## 2) Configure environment

### Build-time (`VITE_*`)

Set in Northflank build env:

```env
VITE_GRAPHQL_ENDPOINT=https://your-cms.example.com/api/graphql
VITE_RENDER_ENDPOINT=https://your-app.northflank.app
```

`VITE_*` values are baked into the client bundle; changes require redeploy.

### Runtime

Set in service env:

```env
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
BETTER_AUTH_SECRET=<random 32+ chars>
```

Optional tuning:
- `RENDER_ALLOWED_IPS`
- `RENDER_CACHE_MAX`
- `AUTH_PORT`, `AUTH_HOST`

---

## 3) One-time DB schema apply

Auth schema migration is not run automatically in container startup.

```sh
psql "$DATABASE_URL" -f apps/auth-service/migrations/auth-schema.sql
```

---

## 4) Deploy + verify

Deploy, then verify:

```sh
curl https://your-app.northflank.app/health
open https://your-app.northflank.app
```

Also ensure Keystone CORS allows your app origin.

---

## 5) Smoke test

- App loads
- Sign-in flow works through `/api/auth`
- Preview renders via `/render`
- No CORS/auth/network errors in browser console

---

## Troubleshooting

- **Preview errors:** verify `VITE_RENDER_ENDPOINT` and `/health`.
- **GraphQL failures:** verify `VITE_GRAPHQL_ENDPOINT` + Keystone CORS.
- **Auth schema errors:** re-run migration and verify `auth` schema/tables exist.
- **Restarts/crashes:** check service logs for process exit cause (`docker/entrypoint.sh`).
