# resume-studio

<div align="flex flex-row items-center justify-center">
  <img src="apps/web/public/logo.png" alt="resume-studio logo" width="50" />
  <h2>resume-studio</h2>
</div>

Edit your resume. See it live. Ship it.

Real-time resume editor web app. Loads resume data from the Keystone CMS GraphQL API, renders live previews via multiple [JSON Resume](https://jsonresume.org/) themes, and persists changes on explicit **Save**.

> **Status:** Guest mode available (no auth required). Authenticated mode implemented via Better Auth + Cognito.

## Features

- **Guest mode** — try the editor immediately without signing in. Create and import resumes locally, preview and export freely. No data is saved to the CMS.
- **Authenticated mode** — sign in via Cognito (Better Auth broker) to load existing resumes from the CMS, edit, and save. Create new resumes locally first, then persist on Save.
- Startup dialog — on launch, shows existing resumes as selectable cards (authenticated) or prompts to create/import (guest). Fetching/empty/error/guest states handled gracefully.
- Create new resumes from the header `+` button or the startup dialog — populates the editor locally with a blank template. No CMS round-trip until you Save.
- Edit any JSON Resume section: basics, work (with highlights), education, skills, interests, volunteer, projects, certificates, languages, awards, publications.
- Live preview updates 300 ms after last keystroke, in a sandboxed iframe — with skeleton/overlay loading states so edits never flash blank.
- Loading states throughout via shadcn `Skeleton` / `Spinner`: resume picker, preview first paint + refresh overlay, save pending, print page.
- Save button shows a saving state (spinner + disabled) during the entire save flow, including early-exit paths (`try/finally`). Hidden in guest mode.
- Import JSON Resume files from the startup dialog.
- Schema-aligned validation: email/phone regexes and required-field rules mirror the Keystone CMS; legacy select values surface as non-blocking warnings. Powered by Zod.
- CMS `select` fields render as dropdowns (skill level, language fluency) with options mirrored from the schema.
- Save-time staleness check blocks writes when the resume changed on the server since load.
- Theme switcher — 9 vendored in-repo themes: `developer-mono`, `flat`, `modern-classic`, `writers-portfolio`, `nordic-minimal`, `graph-paper-grid`, `monochrome-noir`, `new-york-editorial`, `claude`.
- Preview / print flow — opens a dedicated `/print` page with the rendered resume in a full-height iframe; use the browser's **Print → Save as PDF** to export.
- Drag-and-drop reorder for work, education, and skills.
- Explicit save → typed mutation plan → batched execute against Keystone.
- Empty states — both editor and preview panes show "No resume selected" when no resume is loaded.

## Architecture

```
Browser (React 19 SPA)
  ├─ AuthProvider (Better Auth session gating)
  ├─ editor state (Zustand)
  ├─ TanStack Query cache (gated by isAuthenticated)
  ├─ shadcn/ui primitives (radix base) + Tailwind CSS v4
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
    ├── ARCHITECTURE.md
    ├── DEPLOYMENT.md
    ├── FUNCTIONAL_REQUIREMENTS.md
    ├── KNOWN_ISSUES.md
    ├── CONTRIBUTING.md
    └── LOCAL_DEV.md
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
pnpm test           # vitest across workspace (91 tests)
pnpm typecheck
pnpm lint           # eslint (root flat config)
pnpm build          # tsc + vite production build
pnpm codegen        # regenerate GraphQL types (needs Keystone reachable)
```

See [docs/LOCAL_DEV.md](./docs/LOCAL_DEV.md) for full local setup, [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for Northflank deployment, [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) for the contribution flow, [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) and [docs/FUNCTIONAL_REQUIREMENTS.md](./docs/FUNCTIONAL_REQUIREMENTS.md) for design + feature specs, [docs/KNOWN_ISSUES.md](./docs/KNOWN_ISSUES.md) for known issues, and `AGENTS.md` for AI agent onboarding.

## License

See [LICENSE](./LICENSE).
