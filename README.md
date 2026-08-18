# resume-studio

Edit your resume. See it live. Ship it.

Real-time resume editor web app. Loads resume data from the Keystone CMS GraphQL API, renders live previews via multiple [JSON Resume](https://jsonresume.org/) themes, and persists changes on explicit **Save**.

> **Status:** milestone 0 complete (repo scaffold). Milestone 1 next (transformer round-trip).

## Features

- Edit resume data (per language) through a web form.
- Live preview updates as you type.
- Theme switcher — MVP ships with `stackoverflow`, `even`, `elegant`.
- Undo / redo.
- Explicit save back to Keystone GraphQL (no autosave surprises).

## Architecture

```
Browser (React SPA)
  ├─ editor state (Zustand + zundo)
  ├─ TanStack Query cache
  └─ iframe preview (JSON Resume themes)
        │
        ▼
Keystone CMS GraphQL API
```

## Tech Stack

- React SPA + Vite
- Zustand (+ zundo for undo/redo)
- TanStack Query
- JSON Resume themes rendered in an iframe
- Keystone CMS as the GraphQL backend (shared with `nimbus-tech`)

## Repo Layout

```
resume-studio/
├── apps/
│   ├── web/              # React + Vite SPA (port 5173)
│   └── render-service/   # Fastify + resumed (port 8787)
└── packages/
    ├── transformer/     # CMS ⇄ JSON Resume codecs
    ├── graphql-client/  # graphql-codegen output (Keystone SDL)
    └── themes/          # pinned JSON Resume theme registry
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
pnpm test           # vitest across workspace
pnpm typecheck
pnpm codegen        # regenerate GraphQL types (needs Keystone reachable)
```

The Keystone CMS must be running separately at `http://localhost:3000` with
`http://localhost:5173` and `http://localhost:8787` in its `CORS_ORIGIN`.

## Scope

**In (MVP):** local dev, form editing, live preview, theme switch, save, undo/redo.

**Out (MVP):** auth, public deploy, in-app PDF export, new themes, GraphQL schema changes, concurrent-edit protection, `basics.image` upload.

## License

See [LICENSE](./LICENSE).
