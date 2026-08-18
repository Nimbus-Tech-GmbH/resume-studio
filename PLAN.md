# resume-studio — Project Plan

Real-time resume editor webapp. Loads resume data from the Keystone CMS GraphQL API
(shared with `nimbus-tech`), renders live previews via multiple JSON Resume themes,
and persists changes on explicit **Save**.

**Status**: planning → milestone 0 (repo scaffold).

---

## 1. Goals

- Edit resume data (per language) via a web form.
- Live preview updates as user types, with theme switcher (3 themes for MVP:
  `stackoverflow`, `even`, `elegant`).
- Persist changes back to Keystone GraphQL via a single **Save** action.
- Undo/redo.
- Local development first. Auth, deploy, and multi-tenant concerns deferred.

## 2. Non-Goals (MVP)

- Auth / login flow (local dev only, no Cognito wiring yet).
- Public deployment.
- PDF generation in-app (link to browser print or existing `scripts/generate:resume-files` pipeline).
- Building new JSON Resume themes.
- Modifying the GraphQL schema, **except** possibly adding an `order` field to
  `ResumeHighlight` if it doesn't already exist (needed for stable highlight reorder).
- Concurrent-edit protection (last-write-wins for now).
- Editing `basics.image` (upload flow); read-only in MVP.

## 3. Architecture

```
┌─────────────────────────┐
│ Browser (React SPA)     │
│  - editor state (Zustand + zundo)
│  - TanStack Query cache │
│  - iframe preview       │
└──────┬──────────┬───────┘
       │          │
       │ GraphQL  │ POST /render (debounced 300ms)
       │ query+mutation
       │ credentials: include
       ▼          ▼
┌──────────────┐ ┌──────────────────────┐
│ Keystone CMS │ │ Render Service       │
│ (nimbus-tech)│ │ (Fastify + resumed)  │
│ /api/graphql │ │ POST /render         │
│ NextAuth +   │ │ - 3 themes preloaded │
│ Cognito      │ │ - LRU cache          │
│              │ │ - IP allowlist       │
└──────────────┘ └──────────────────────┘
```

Two deployable units, both run locally in dev:

- `apps/web` — React + Vite SPA (Vite dev server, `http://localhost:5173`).
- `apps/render-service` — Fastify service (`http://localhost:8787`).

The Keystone CMS runs in its own repo (`nt-keystone-cms`) at `http://localhost:3000`.

## 4. Data Flow

### Load
1. React app fetches resumes via GraphQL (`credentials: 'include'`).
2. `transformer.fromCms(cmsResume) → jsonResume` runs in-browser.
3. Editor state seeded with `jsonResume`.

### Edit (real-time preview, no persistence)
1. Form edits update Zustand store (schema mirrors JSON Resume, not CMS).
2. State change → debounce 300ms → `POST /render { resume, theme }` → HTML string.
3. HTML injected into `<iframe sandbox="allow-same-origin" srcdoc={html}>`.
4. Iframe isolates theme CSS/JS from editor UI. No theme bundling in browser.

### Save (persist)
1. User clicks Save.
2. Diff current `jsonResume` vs last-loaded snapshot.
3. `transformer.toCms(diff, original) → mutation plan` — typed list of GraphQL ops:
   - `updateResumeSkill(id, { keywords: "a✌🏻b" })`
   - `createResumeHighlight({ value, order, work: { connect: { id } } })`
   - `deleteResumeHighlight(id)`
   - `updateResume(id, { work: { set: [{id: ...}, ...] } })` for reorder
4. Batched as single GraphQL document (multiple named mutations).
5. On success → refetch resume → re-seed store.
6. On error → keep dirty state, per-op toast, no local rollback needed.

### Theme switch
Pure client action → re-request `/render` with new theme.

## 5. Transformer Contract

Located in `packages/transformer`. Shared by web + tests.

**Rule**: `toCms(fromCms(x))` is idempotent on the CMS side, modulo list-delimiter
normalization to `✌🏻`.

| JSON Resume field | CMS field | Codec |
|---|---|---|
| `skills[].keywords: string[]` | `ResumeSkill.keywords: String` | `join('✌🏻')` / split priority `✌🏻` → `\n` → `,;` |
| `interests[].keywords: string[]` | `ResumeInterest.keywords: String` | same |
| `volunteer[].highlights: string[]` | `ResumeVolunteer.highlights: String` | same |
| `education[].courses: string[]` | `ResumeEducation.courses: String` | same |
| `projects[].highlights: string[]` | `ResumeProject.highlights: String` | same |
| `work[].highlights: string[]` | `ResumeHighlight[]` relation rows | create / update / delete + `set` for order |
| `basics.image: string` | `ResumeBasicInformation.image: Image` relation | read-only in MVP |
| `certificates[]: {name,url,summary}` | `Certification` rows w/ `{title, link, description}` | rename map |
| dates `YYYY-MM-DD` | `DateTime` | ISO parse, reject invalid before mutation |

Bad dates or codec failures block Save with inline error.

## 6. Repo Layout

```
resume-studio/
├── PLAN.md
├── README.md
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── packages/
│   ├── transformer/          # CMS ⇄ JSON Resume
│   │   ├── src/
│   │   │   ├── fromCms.ts    # port of scripts/exportResumes/convert.ts
│   │   │   ├── toCms.ts      # NEW reverse direction
│   │   │   ├── listCodec.ts  # ✌🏻 join/split
│   │   │   ├── dateCodec.ts
│   │   │   └── types.ts      # CmsResume, JsonResume
│   │   └── *.test.ts
│   ├── graphql-client/       # generated types + operations
│   │   ├── codegen.yml
│   │   └── src/generated.ts
│   └── themes/               # pinned theme deps + registry
└── apps/
    ├── web/                  # React + Vite + TanStack Query
    │   ├── src/
    │   │   ├── main.tsx
    │   │   ├── App.tsx
    │   │   ├── editor/       # form components per section
    │   │   ├── preview/      # iframe preview + render client
    │   │   ├── state/        # zustand store + zundo
    │   │   ├── graphql/      # queries, mutations, save planner
    │   │   └── routes/
    │   ├── index.html
    │   └── vite.config.ts
    └── render-service/       # Fastify + resumed
        ├── src/
        │   ├── server.ts
        │   ├── render.ts     # port of scripts/generateResumeFiles/render.ts
        │   ├── cache.ts      # LRU
        │   └── auth.ts       # IP allowlist middleware
        └── Dockerfile        # for later deploy
```

## 7. Tech Stack

- **Language**: TypeScript strict.
- **Package manager**: pnpm workspaces.
- **Web**: React 19, Vite, TanStack Query v5, Zustand + zundo (undo/redo),
  react-hook-form, @dnd-kit/core (reorder), ajv (JSON Resume schema validation),
  Tailwind CSS.
- **Codegen**: graphql-codegen against Keystone SDL.
- **Render service**: Fastify + `resumed` + `jsonresume-theme-stackoverflow`,
  `jsonresume-theme-even`, `jsonresume-theme-elegant`. LRU cache.
- **Testing**: Vitest across all packages.
- **Lint/format**: ESLint + Prettier.

## 8. Auth Strategy (MVP: none)

- No auth for local dev.
- Keystone `CORS_ORIGIN` must include `http://localhost:5173` (Vite) and
  `http://localhost:8787` (render svc).
- All fetch calls already use `credentials: 'include'` so wiring Cognito later
  is config, not a rewrite.
- Render service:
  - Bound to `127.0.0.1`.
  - IP allowlist middleware (`127.0.0.1`, `::1`; `RENDER_ALLOWED_IPS` env override).
  - CORS allowlist: `http://localhost:5173`.
  - **Do not expose publicly until auth is added.**

## 9. Milestones

| # | Deliverable | Est |
|---|---|---|
| 0 | Repo scaffold (pnpm workspace, TS, codegen, Vite, Fastify skeletons) | 0.5d |
| 1 | Transformer package + round-trip property tests | 2d |
| 2 | Render service (3 themes preloaded, LRU cache, IP allowlist) | 1d |
| 3 | Keystone dev CORS + local GraphQL client wired end-to-end | 0.5d |
| 4 | Read-only editor (fetch → transform → preview, no editing) | 1d |
| 5 | Editing + debounced preview + theme switcher | 3d |
| 6 | Undo/redo + drag-and-drop reorder (work / edu / skills) | 1.5d |
| 7 | Save pipeline: diff → mutation plan → batched execute | 3d |
| 8 | ajv validation + error UX + empty states | 1d |
| 9 | README, local dev docs, contribution guide | 0.5d |

**~14 dev days MVP (local-only).** Auth + public deploy = follow-up phase.

## 10. Open Questions / Risks

1. **Keystone dev session** — does the local Keystone allow unauthenticated GraphQL,
   or does `isAccessAllowed` block reads? If it blocks, we need a dev-only bypass
   or a seeded session cookie. Confirm during milestone 3.
2. **`ResumeHighlight.order` field** — check schema in milestone 1; if missing,
   small PR to `nt-keystone-cms` to add `order: Int`.
3. **Save atomicity** — Keystone has no GraphQL transactions. Ordered execution
   (creates → updates → deletes) + per-op error surfacing. Accepted risk.
4. **Elegant theme errors** — some resume shapes trigger upstream errors. Preview
   shows error banner without crashing editor.
5. **Concurrent edits** — deferred. Store `updatedAt` client-side so adding a
   staleness check later = server compare only.

## 11. References

- JSON Resume schema — https://jsonresume.org/schema
- JSON Resume themes — https://jsonresume.org/themes/
- `resumed` — https://github.com/rbardini/resumed
- `nimbus-tech/scripts/exportResumes/` — CMS → JSON Resume converter (source of truth to port)
- `nimbus-tech/scripts/generateResumeFiles/render.ts` — theme render + post-processors to port
- `nimbus-tech/scripts/RESUME_GENERATION.md` — end-to-end CLI reference
- `nt-keystone-cms/schema.graphql` — Keystone SDL
- `nt-keystone-cms/keystone.ts` — Keystone config (CORS, session)
