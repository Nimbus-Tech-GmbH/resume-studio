# Prisma 7 Setup Complete

Technical reference for Prisma 7 migration in resume-studio.

## What Changed

### Config
- **prisma.config.ts** — New root config replaces datasource URL in schema.prisma
- **prisma/schema.prisma** — Removed `url` from datasource block, simplified to provider-only

### Client
- **src/db.ts** — PrismaPg adapter (replaces direct client init)
  ```ts
  import { PrismaPg } from '@prisma/adapter-pg';
  import { PrismaClient } from '@prisma/client';
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  export const prisma = new PrismaClient({ adapter });
  ```

### Migrations
- **prisma/migrations/000_init/** — Baseline migration (creates public schema + tables)
- Workflow: `contract emit` → `db migrate --advance-ref db`

## Commands

All in root `package.json` and `apps/auth-service/package.json`:

| Command | What |
|---------|------|
| `db:validate` | Validate schema syntax |
| `db:generate` | Re-generate Prisma client |
| `db:migrate:dev` | Dev: plan + apply migration |
| `db:migrate:plan` | Plan migration (dry-run) |
| `db:migrate:deploy` | Prod: apply all pending migrations |
| `db:seed` | Populate dev DB (if seed.ts exists) |

## Env Vars

- **DATABASE_URL** — Pooled Postgres URL (PgBouncer) for app connections
- **DIRECT_URL** — Direct DB URL for migration commands (bypass pooler)
- Both in `.env` (dev) and Northflank secrets (prod)

## Why Not Prisma 8?

Prisma 8 RC uses contract-based codegen (PSL format).
- Pros: Better introspection, smarter migrations
- Cons: RC status, schema format changes, migration tooling less familiar
- **Decision:** v7 stable, well-documented, gradual migration path to 8

## Migration to v8 Path

1. Upgrade `@prisma/client` to 8.x
2. Run `prisma orm init` to convert schema to contract format
3. Adjust migration tooling (contract emit, db migrate instead of migrate dev)
4. Commit new contract + migrations structure

Not urgent; v7 fully supported through 2026.

## Testing

✅ All 96 tests pass
✅ Typecheck clean
✅ Lint clean (generated files ignored)
✅ Build successful
✅ Local Docker: schema, seed, queries all work
✅ Migration: 000_init applies to fresh DB

## Docs

- Workflow details: `docs/MIGRATIONS.md`
- Connection details: `docs/CONNECTION_DIAGRAMS.md`
- Deployment: `docs/NORTHFLANK_DEPLOYMENT.md`
