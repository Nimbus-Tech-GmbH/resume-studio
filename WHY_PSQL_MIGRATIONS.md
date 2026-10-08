# Why PSQL for Migrations, Not Prisma?

Answered.

## Short Answer

psql migrations + Prisma client = best of both worlds:
- **psql:** full SQL control, portable, familiar to DBAs, no schema lock-in
- **Prisma:** safe queries in app code, type-safe client

## Prisma 7 Changes This

Prisma 7 CLI now includes proper migration tooling (`db migrate`, `migration plan`), but...

### Prisma Migrate (v6 model) problems

1. **Shadow DB:** Required for `prisma migrate dev`
   - Extra Postgres instance
   - Extra cost on managed DBs
   - Network latency for introspection
   - Single-tenant only (can't replicate on shared schema)

2. **Lock-in:** Migrations stored in Prisma format (metadata + SQL)
   - Hard to version-control alongside raw SQL
   - Requires Prisma CLI to inspect history
   - Schema drift if hand-edited

3. **Complexity:** Multiple move phases (dev → staging → prod)
   - `migrate dev` (with shadow)
   - `migrate resolve` (if conflict)
   - `migrate deploy` (prod)

### Prisma 7 approach (better, but still opinionated)

- No shadow DB (introspect current schema instead)
- `contract` format (PSL schema + migration plan)
- Still Prisma-proprietary workflow

### Why we chose direct psql + Prisma client

**Migration layer:** Raw SQL in psql
- No vendor lock-in
- Schema portable to other tools (Django ORM, sqlc, etc.)
- Familiar to SQL teams
- Easier code review (pure SQL diffs)

**App query layer:** Prisma client (v7)
- Type-safe queries
- No SQL injection
- Runtime validation against schema
- Faster iteration than hand-written queries

**Workflow:** Manual migration plan + psql apply
- DBA reviews SQL before apply
- Versioned in git (one SQL file per change)
- Familiar to ops/DevOps
- No extra tooling in production

### Tradeoff

- **Pro:** portability, clarity, less vendor lock-in
- **Con:** manual migration planning (use `migration plan` as draft, review, apply with psql)

## How It Works in This Project

1. **Dev:** Edit schema, plan migrations
   ```bash
   pnpm --filter @resume-studio/auth-service db:migrate:plan --name add_user_phone
   ```
   → Writes SQL to `migrations/app/TIMESTAMP_name/migration.sql`

2. **Review:** Inspect SQL (diff in PR, ask team)

3. **Apply locally:**
   ```bash
   psql "$DATABASE_URL" -f migrations/app/TIMESTAMP_name/migration.sql
   ```

4. **Apply on prod:** Same command + DIRECT_URL (manual or via Northflank)

## Prisma 7 vs 8

- **v7:** Migrate CLI less mature, still v6-adjacent
- **v8:** Dedicated `db migrate` command, contract-based, better UX

We're on v7 stable (2026 support). Upgrade to v8 when RC → stable (Q2 2025).

## See Also

- `docs/MIGRATIONS.md` — Step-by-step workflow
- `apps/auth-service/prisma/migrations/000_init/migration.sql` — Real example
