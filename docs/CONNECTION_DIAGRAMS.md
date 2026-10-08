# Connection Flow Diagrams

---

## Local Development (Docker)

```
Browser
  └─ http://localhost:5173
      ├─ POST /render
      │   └─ Render Service (port 8787)
      │       └─ Fastify → Vite proxy
      │
      ├─ /api/auth/*
      │   └─ Vite proxy → Auth Service (port 4000)
      │       └─ Better Auth + Cognito
      │
      └─ POST /graphql
          └─ Vite proxy → Keystone CMS (port 3000)

Auth Service (port 4000)
  └─ DATABASE_URL (direct)
      └─ Postgres 127.0.0.1:5434
          └─ resume-auth DB
              └─ auth schema
                  ├─ user table
                  ├─ session table
                  ├─ account table
                  └─ verification table
```

**Connection string:**
```
postgres://admin:dev-auth-pass@127.0.0.1:5434/resume-auth
```

Prisma Client flow:
```
db.ts (PrismaClient + PrismaPg)
  └─ Pool (DATABASE_URL)
      └─ search_path=auth (set by adapter)
          └─ all queries target auth schema
```

---

## Production (Northflank)

```
Browser
  └─ https://your-app.northflank.app:443 (CDN/LoadBalancer)
      │
      ├─ GET /* (static SPA)
      │   └─ Render Service (port 5173)
      │       └─ Fastify serves SPA
      │
      ├─ POST /render
      │   └─ Render Service (port 5173)
      │       └─ Fastify theme render
      │
      ├─ /api/auth/* (proxy)
      │   └─ Render Service
      │       └─ localhost:4000 → Auth Service (port 4000)
      │           └─ Better Auth + Cognito
      │
      └─ POST /graphql
          └─ Render Service proxy (if needed)
              └─ https://cms.example.com/api/graphql (external Keystone)

┌──────────────────────┐
│ Northflank Container │
│  ┌────────────────┐  │
│  │ Render Service │  │
│  │ Fastify 5173   │  │
│  │ ├─ SPA         │  │
│  │ ├─ /render     │  │
│  │ └─ /api/auth/* │  │
│  └────────────────┘  │
│    ↓                 │
│  ┌────────────────┐  │
│  │ Auth Service   │  │
│  │ Fastify 4000   │  │
│  │ Better Auth    │  │
│  └────────────────┘  │
│    ↓ (DATABASE_URL)  │
└────────┬─────────────┘
         │
    Prisma Postgres
    ┌──────────────────────┐
    │ pooled.db.prisma.io  │ (runtime pooled)
    │ db.prisma.io         │ (migrations direct)
    │                      │
    │ resume-auth DB       │
    │ └─ auth schema       │
    │   ├─ user            │
    │   ├─ session         │
    │   ├─ account         │
    │   └─ verification    │
    └──────────────────────┘
```

**Connection strings (Prisma Postgres):**
```
DATABASE_URL (pooled, runtime):
  postgres://USER:PASSWORD@pooled.db.prisma.io:5432/postgres?sslmode=require

DIRECT_URL (direct, migrations):
  postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require
```

Prisma Client flow (same as local):
```
db.ts (PrismaClient + PrismaPg)
  └─ Pool (DATABASE_URL pooled)
      └─ search_path=auth (set by adapter)
          └─ all queries target auth schema
```

---

## Deployment Flow

```
Local Dev
  ├─ Edit code
  ├─ pnpm dev (test)
  ├─ pnpm typecheck
  └─ git push origin

            ↓

GitHub (main branch)
  ├─ Webhook → Northflank
  └─ Build triggered

            ↓

Northflank Build
  ├─ pnpm install
  ├─ pnpm generate (Prisma Client)
  ├─ pnpm build (TypeScript)
  └─ Docker build
      └─ Image pushed to registry

            ↓

Northflank Container Start
  ├─ docker/entrypoint.sh
  ├─ Render Service (port 5173)
  ├─ Auth Service (port 4000)
  └─ Health check (/health)

            ↓

Production Live
  └─ https://your-app.northflank.app
```

---

## Schema Application Timeline

```
┌─── One-time (before first deploy) ───┐

1. Create Prisma Postgres DB
   └─ Get pooled + direct URLs

2. Apply migrations (using DATABASE_URL + DIRECT_URL)
   DATABASE_URL="pooled" DIRECT_URL="direct" pnpm --filter @resume-studio/auth-service exec prisma migrate deploy
   └─ Creates auth schema + 4 tables

3. Verify
   psql "$DIRECT_URL" -c '\dt auth.*'
   └─ Should list user, session, account, verification

4. Deploy to Northflank
   └─ Container starts, connects to Postgres
       └─ Auth service online

└──────────────────────────────────────┘

After deployment: Schema persists across container restarts.
Code updates redeploy without reapplying schema.
```

---

## Prisma Client Generation

```
Local Dev:
  pnpm --filter @resume-studio/auth-service exec prisma generate
  └─ Reads DATABASE_URL (direct connection)
  └─ Introspects schema
  └─ Generates TypeScript client
  └─ Outputs to apps/auth-service/prisma/generated/

Northflank Build:
  pnpm generate
  └─ Reads DATABASE_URL (pooled connection for Prisma Postgres)
  └─ If DATABASE_URL is pooled, uses DIRECT_URL for introspection
  └─ Generates client at build time
  └─ Baked into container image

Runtime:
  import { prisma } from './db.js'
  └─ Uses generated client
  └─ PrismaPg adapter handles pooled connection
  └─ All queries isolated to auth schema
```

---

## Error Scenarios

### "Could not validate the database schema" (HTTP 500)

```
Container attempts auth operation
  └─ Prisma Client connects to DB
  └─ Queries auth schema
  └─ Schema does not exist (or is empty)
  └─ HTTP 500

Fix: Apply migrations before deploy
  DATABASE_URL="pooled" DIRECT_URL="direct" pnpm --filter @resume-studio/auth-service exec prisma migrate deploy
```

### Build hangs at "pnpm generate"

```
DATABASE_URL is pooled (Prisma Postgres)
  └─ Prisma CLI tries to introspect via pooled endpoint
  └─ Pooled endpoint rejects long-running introspection query
  └─ Timeout or hang

Fix: Provide DIRECT_URL
  DIRECT_URL="postgres://..." pnpm generate
```

### "Connection refused: 127.0.0.1:4000"

```
Browser → Render Service → Auth Service
  └─ Auth Service not running
  └─ Port 4000 is not listening

Fix: Check auth-service logs
  docker logs <container-id>
```

---

## Rollback after deploy

```
Northflank → Deployments → Previous Build → Revert
  └─ Old code image restarts
  └─ Container still connects to same Postgres
  └─ Data not affected (Postgres persists)
  └─ Sessions/users remain
```

---

## Quick env reference

| Var | Local | Prod (Prisma) | Scope |
|---|---|---|---|
| `DATABASE_URL` | Direct to Docker Postgres | Pooled Prisma URL | Runtime |
| `DIRECT_URL` | Omit | Direct Prisma URL | CLI/Migrations |
| `VITE_GRAPHQL_ENDPOINT` | http://localhost:3000/api/graphql | https://cms.example.com/api/graphql | Build |
| `VITE_RENDER_ENDPOINT` | http://localhost:8787 | https://your-app.northflank.app | Build |
| `AUTH_URL` | http://localhost:5173 | https://your-app.northflank.app | Runtime |
| `COGNITO_CLIENT_ID` | dev client | prod client | Runtime |

---

Generated: 2026-10-08
