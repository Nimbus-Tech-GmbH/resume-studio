# resume-studio

<div align="flex flex-row items-center justify-center">
  <img src="apps/web/public/logo.png" alt="resume-studio logo" width="50" />
  <h2>resume-studio</h2>
</div>

Edit your resume. See it live. Ship it.

Real-time resume editor web app. Loads resume data from the Keystone CMS GraphQL API and renders live previews via multiple [JSON Resume](https://jsonresume.org/) themes. Persistence is currently disabled (save pipeline retained, see below).

> **Status:** Guest mode available (no auth required). Authenticated mode working: Better Auth + Cognito OAuth, with user account sync between resume-studio auth DB and Keystone CMS.

## Features

- **Guest mode** — try the editor immediately without signing in. Create and import resumes locally, preview and export freely. No data is saved to the CMS.
- **Authenticated mode** — sign in via Cognito (Better Auth broker) to load existing resumes from the CMS and edit them. User accounts are automatically synced between resume-studio and Keystone. Persistence is available when deployed. Create new resumes locally first; new resume sync is queued for a future milestone.
- Startup dialog — on launch, shows existing resumes as selectable cards (authenticated) or prompts to create/import (guest). User accounts automatically synced from Keystone on first sign-in. Fetching/empty/error/guest states handled gracefully.
- Create new resumes from the header `+` button or the startup dialog — populates the editor locally with a blank template. No CMS round-trip (persistence currently disabled).
- Edit any JSON Resume section: basics, work (with highlights), education, skills, interests, volunteer, projects, certificates, languages, awards, publications.
- Live preview updates 300 ms after last keystroke, in a sandboxed iframe — with skeleton/overlay loading states so edits never flash blank.
- Loading states throughout via shadcn `Skeleton` / `Spinner`: resume picker, preview first paint + refresh overlay, print page.
- Save button is hidden for all users while persistence is disabled (a "Save disabled" badge shows when signed in). The typed mutation-plan save pipeline remains in place and tested (see `docs/SAVE_PIPELINE.md`).
- Import JSON Resume files from the startup dialog.
- Schema-aligned validation: email/phone regexes and required-field rules mirror the Keystone CMS; legacy select values surface as non-blocking warnings. Powered by Zod.
- CMS `select` fields render as dropdowns (skill level, language fluency) with options mirrored from the schema.
- Theme switcher — 9 vendored in-repo themes: `developer-mono`, `flat`, `modern-classic`, `writers-portfolio`, `nordic-minimal`, `graph-paper-grid`, `monochrome-noir`, `new-york-editorial`, `claude`.
- Preview / print flow — opens a dedicated `/print` page with the rendered resume in a full-height iframe; use the browser's **Print → Save as PDF** to export.
- Drag-and-drop reorder for work, education, and skills.
- Empty states — both editor and preview panes show "No resume selected" when no resume is loaded.

## Architecture

```
Browser (React 19 SPA)
  ├─ AuthProvider (Better Auth session gating)
  ├─ editor state (Zustand)
  ├─ TanStack Query cache (gated by isAuthenticated)
  ├─ shadcn/ui primitives (radix-mira style) + Tailwind CSS v4
  ├─ @dnd-kit sortable lists
  └─ iframe preview (JSON Resume themes)
        │
        ├─ /api/auth ──→ Vite proxy (dev) / render-service proxy (prod) ──→ Auth Service
        │ POST /render (debounced 300ms)
        ▼
Render Service (Fastify)                ← dev: port 8787, prod: port 5173
  ├─ serves SPA static files (prod only)
  ├─ /api/auth prod proxy → auth-service
  ├─ 9 vendored themes (lazy-loaded)
  ├─ LRU cache (SHA-1 keyed)
  └─ IP allowlist + CORS
        │
        ▼
Auth Service (Fastify)                 ← port 4000, 127.0.0.1 bound
  ├─ Better Auth + Cognito OAuth broker
  └─ Postgres `auth` schema (never touches Keystone public schema)
        │
        │
Keystone CMS GraphQL (external — nt-keystone-cms)
```

**Dev mode:** web (Vite, port 5173), render-service (Fastify, port 8787) and auth-service (Fastify, port 4000) run as separate processes; Vite proxies `/api/auth` to the auth-service so the browser stays single-origin at 5173.
**Prod (Docker):** single container — render-service serves the SPA from `/`, handles `/render` on port 5173, and proxies `/api/auth` to the in-image auth-service on port 4000.

## Repo Layout

```
resume-studio/
├── apps/
│   ├── web/              # React + Vite SPA (port 5173)
│   │   └── src/
│   │       ├── auth/     # AuthContext (guest/authenticated toggle)
│   │       ├── editor/   # Form editor, save, resume picker
│   │       ├── preview/  # iframe preview + render client
│   │       ├── state/    # Zustand store
│   │       └── ...
│   ├── render-service/   # Fastify + resumed (port 8787)
│   └── auth-service/     # Fastify + Better Auth + Cognito (port 4000)
├── packages/
│   ├── transformer/     # CMS ⇄ JSON Resume codecs + toCms diff planner
│   ├── graphql-client/  # hand-written GraphQL operations
│   ├── themes/          # pinned JSON Resume theme registry
│   └── vendor/          # vendored upstream JSON Resume themes (9)
└── docs/
    ├── README.md                     # Documentation index
    ├── NORTHFLANK_DEPLOYMENT.md      # Production deployment
    ├── MIGRATIONS.md                 # Database migrations
    ├── LOCAL_DEV.md                  # Local setup
    ├── ARCHITECTURE.md               # System design
    ├── QUICK_REFERENCE.md            # Command cheatsheet
    ├── SAVE_PIPELINE.md              # Data flow
    ├── CONTRIBUTING.md               # Code style & guidelines
    ├── CONNECTION_DIAGRAMS.md        # Architecture diagrams
    ├── DOMAIN_RELATIONSHIP.md        # CMS schema
    ├── FUNCTIONAL_REQUIREMENTS.md    # Features
    └── KNOWN_ISSUES.md               # Limitations
```

## Getting Started

Requires Node ≥ 20.11 and pnpm ≥ 9.

```sh
pnpm install
cp .env.example .env
pnpm dev            # runs web + render-service + auth-service in parallel
```

Or run individually:

```sh
pnpm dev:web        # http://localhost:5173
pnpm dev:render     # http://localhost:8787
pnpm dev:auth       # http://127.0.0.1:4000 (proxied via /api/auth)
```

**Guest mode** works without Keystone running — no GraphQL calls are made. Click the `+` button or "Create New Resume" to start editing locally. Preview and export work via the render service.

**Authenticated mode** requires the auth-service (Needs Postgres + Cognito creds in `.env`, see [docs/LOCAL_DEV.md](./docs/LOCAL_DEV.md)) and the Keystone CMS running at `http://localhost:3000` with `http://localhost:5173` and `http://localhost:8787` in its `CORS_ORIGIN`. Click **Sign in** in the startup dialog (or the user icon in the header) to start the Cognito OAuth flow. The auth-service must have the callback URL `http://localhost:5173/api/auth/callback/cognito` registered on the Cognito app client.

Other scripts:

```sh
pnpm test           # vitest across workspace (96 tests)
pnpm typecheck
pnpm lint           # eslint (root flat config)
pnpm build          # tsc + vite production build
pnpm codegen        # regenerate GraphQL types (needs Keystone reachable)
```

## Documentation

See the [docs/](./docs/) folder for complete guides:

| Guide | Purpose |
|---|---|
| **[NORTHFLANK_DEPLOYMENT.md](./docs/NORTHFLANK_DEPLOYMENT.md)** | Production deployment: setup, env vars, troubleshooting |
| **[MIGRATIONS.md](./docs/MIGRATIONS.md)** | Database migrations (Prisma 7): create, apply, rollback |
| **[LOCAL_DEV.md](./docs/LOCAL_DEV.md)** | Local development setup: dependencies, services, debugging |
| **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** | System design: services, data flow, auth pipeline |
| **[QUICK_REFERENCE.md](./docs/QUICK_REFERENCE.md)** | Command cheatsheet: migrations, build, deployment |
| **[CONTRIBUTING.md](./docs/CONTRIBUTING.md)** | Code style, component patterns, PR guidelines |

For all documentation links and workflows, see [docs/README.md](./docs/README.md).

## Database & Migrations

**Schema:** PostgreSQL with `auth` schema (isolated from Keystone)

**ORM:** Prisma 7 with PrismaPg driver adapter (direct, type-safe queries)

**Config:** `prisma.config.ts` at `apps/auth-service/` loads `DATABASE_URL` from root `.env` automatically

**Apply migrations:**

```bash
# From root (loads DATABASE_URL automatically)
pnpm db:migrate:deploy
```

Or plan and review before applying:

```bash
pnpm --filter @resume-studio/auth-service db:migrate:plan --name my_change
pnpm db:migrate:deploy
```

See [docs/MIGRATIONS.md](./docs/MIGRATIONS.md) for creating schema changes, troubleshooting, and production deployment.

## Deploying

**To Northflank:**

1. Create Prisma Postgres database (grab pooled + direct URLs)
2. Apply initial migration (Step 1.2 in [NORTHFLANK_DEPLOYMENT.md](./docs/NORTHFLANK_DEPLOYMENT.md))
3. Follow steps 2-6 to create service, set env vars, and deploy

See [NORTHFLANK_DEPLOYMENT.md](./docs/NORTHFLANK_DEPLOYMENT.md) for complete walkthrough.

## License

See [LICENSE](./LICENSE).
