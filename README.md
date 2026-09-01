# resume-studio

<p align="center">
  <img src="apps/web/public/logo.png" alt="resume-studio logo" width="200" />
</p>

Edit your resume. See it live. Ship it.

Real-time resume editor web app. Loads resume data from the Keystone CMS GraphQL API, renders live previews via multiple [JSON Resume](https://jsonresume.org/) themes, and persists changes on explicit **Save**.

> **Status:** MVP feature-complete (local-only). Auth + public deploy = follow-up phase.

## Features

- Edit any JSON Resume section: basics, work (with highlights), education, skills, interests, volunteer, projects, certificates, languages.
- Live preview updates 300 ms after last keystroke, in a sandboxed iframe — with skeleton/overlay loading states so edits never flash blank.
- Loading states throughout via shadcn `Skeleton` / `Spinner`: resume picker, preview first paint + refresh overlay, save pending, print page.
- Schema-aligned validation: email/phone regexes and required-field rules mirror the Keystone CMS; legacy select values surface as non-blocking warnings.
- CMS `select` fields render as dropdowns (skill level, language fluency) with options mirrored from the schema.
- Save-time staleness check blocks writes when the resume changed on the server since load.
- Theme switcher — 9 vendored in-repo themes: `developer-mono`, `flat`, `modern-classic`, `writers-portfolio`, `nordic-minimal`, `graph-paper-grid`, `monochrome-noir`, `new-york-editorial`, `claude`.
- Preview / print flow — opens a dedicated `/print` page with the rendered resume in a full-height iframe; use the browser's **Print → Save as PDF** to export.
- Drag-and-drop reorder for work, education, and skills.
- Explicit save → typed mutation plan → batched execute against Keystone.

## Architecture

```
Browser (React 19 SPA)
  ├─ editor state (Zustand)
  ├─ TanStack Query cache
  ├─ shadcn/ui primitives (radix base) + Tailwind CSS
  ├─ @dnd-kit sortable lists
  └─ iframe preview (JSON Resume themes)
        │
        │ POST /render (debounced 300ms)
        ▼
Render Service (Fastify + resumed)
  ├─ 9 vendored themes (lazy-loaded)
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
    ├── ARCHITECTURE.md
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
pnpm dev            # runs web + render-service in parallel
```

Or run individually:

```sh
pnpm dev:web        # http://localhost:5173
pnpm dev:render     # http://localhost:8787
```

Other scripts:

```sh
pnpm test           # vitest across workspace (50+ tests)
pnpm typecheck
pnpm lint           # eslint (root flat config)
pnpm build          # tsc + vite production build
pnpm codegen        # regenerate GraphQL types (needs Keystone reachable)
```

The Keystone CMS must be running separately at `http://localhost:3000` with `http://localhost:5173` and `http://localhost:8787` in its `CORS_ORIGIN`.

See [docs/LOCAL_DEV.md](./docs/LOCAL_DEV.md) for full local setup, [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) for the contribution flow, [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) and [docs/FUNCTIONAL_REQUIREMENTS.md](./docs/FUNCTIONAL_REQUIREMENTS.md) for design + feature specs, and [docs/KNOWN_ISSUES.md](./docs/KNOWN_ISSUES.md) for known application/schema issues.

## License

See [LICENSE](./LICENSE).
