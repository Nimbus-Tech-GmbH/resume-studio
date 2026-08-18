# resume-studio

Edit your resume. See it live. Ship it.

Real-time resume editor web app. Loads resume data from the Keystone CMS GraphQL API, renders live previews via multiple [JSON Resume](https://jsonresume.org/) themes, and persists changes on explicit **Save**.

> **Status:** MVP feature-complete (local-only). Auth + public deploy = follow-up phase.

## Features

- Edit any JSON Resume section: basics, work (with highlights), education, skills, interests, volunteer, projects, certificates, languages.
- Live preview updates 300 ms after last keystroke, in a sandboxed iframe.
- Theme switcher — 10 in-repo themes: `developer-mono`, `flat`, `modern-classic`, `writers-portfolio`, `nordic-minimal`, `graph-paper-grid`, `monochrome-noir`, `new-york-editorial`, `claude`, `brutalist`.
- Undo / redo with `⌘Z` / `⌘⇧Z` and toolbar buttons (last 100 states).
- Drag-and-drop reorder for work, education, and skills.
- ajv-backed inline validation banner (emails, URLs, dates).
- Explicit save → typed mutation plan → batched execute against Keystone.

## Architecture

```
Browser (React 19 SPA)
  ├─ editor state (Zustand + zundo)
  ├─ TanStack Query cache
  ├─ react-hook-form-style controlled inputs
  ├─ @dnd-kit sortable lists
  └─ iframe preview (JSON Resume themes)
        │
        │ POST /render (debounced 300ms)
        ▼
Render Service (Fastify + resumed)
  ├─ 3 themes preloaded
  ├─ LRU cache (SHA-1 keyed)
  └─ IP allowlist + CORS
        │
        │
Keystone CMS GraphQL (external — nt-keystone-cms)
```

## Repo Layout

```
resume-studio/
├── apps/
│   ├── web/              # React + Vite SPA (port 5173)
│   └── render-service/   # Fastify + resumed (port 8787)
├── packages/
│   ├── transformer/     # CMS ⇄ JSON Resume codecs + toCms diff planner
│   ├── graphql-client/  # graphql-codegen output + hand-written operations
│   └── themes/          # pinned JSON Resume theme registry
└── docs/
    ├── CONTRIBUTING.md
    └── LOCAL_DEV.md
```

## Getting Started

Requires Node ≥ 20.11 and pnpm ≥ 9.

```sh
pnpm install
cp .env.example .env
pnpm dev            # runs web + render-service in parallel
```

Or run individually:

```sh
pnpm dev:web        # http://localhost:5173
pnpm dev:render     # http://localhost:8787
```

Other scripts:

```sh
pnpm test           # vitest across workspace (20+ tests)
pnpm typecheck
pnpm build          # tsc + vite production build
pnpm codegen        # regenerate GraphQL types (needs Keystone reachable)
```

The Keystone CMS must be running separately at `http://localhost:3000` with `http://localhost:5173` and `http://localhost:8787` in its `CORS_ORIGIN`.

See [docs/LOCAL_DEV.md](./docs/LOCAL_DEV.md) for full local setup and [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) for the contribution flow.

## License

See [LICENSE](./LICENSE).
