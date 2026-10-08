# Documentation Index

Focused guides for resume-studio architecture, setup, deployment, and migrations.

## Setup & Local Development

- **[LOCAL_DEV.md](LOCAL_DEV.md)** — Start dev env, local Postgres, Docker, pnpm scripts
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — High-level app structure, boundaries, data flow, auth wiring
- **[SAVE_PIPELINE.md](SAVE_PIPELINE.md)** — How saves work (toCms → operations → executeSave)
- **[DOMAIN_RELATIONSHIP.md](DOMAIN_RELATIONSHIP.md)** — Entity relationships and mutation handling

## Database & Migrations

- **[MIGRATIONS.md](MIGRATIONS.md)** — Prisma 7 migration workflow (contract emit, db migrate, --advance-ref)
- **[CONNECTION_DIAGRAMS.md](CONNECTION_DIAGRAMS.md)** — DB connection pooling, datasource URLs, direct vs pooled

## Deployment

- **[NORTHFLANK_DEPLOYMENT.md](NORTHFLANK_DEPLOYMENT.md)** — Deploy to Northflank (env setup, container build, runtime)

## Quick Links

- Root README: ../README.md
- Project rules: ../AGENTS.md
