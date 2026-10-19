# resume-studio

Edit your resume. See it live. Export it fast.

`resume-studio` is a pnpm monorepo for a JSON Resume editor:
- React/Vite web app (`apps/web`)
- Fastify render service (`apps/render-service`)
- Fastify auth broker with Better Auth + Cognito (`apps/auth-service`)
- AI gateway service for tailoring requests (`apps/ai-service`)
- Shared transformer/theme/graphql/ai-contract packages (`packages/*`)

## Current status

- **Guest mode:** fully usable for local create/import/edit/preview/print.
- **Authenticated mode:** sign-in + CMS read/load paths are wired.
- **Persistence:** save pipeline exists and is tested, but save UI is currently not exposed.

## Quick start

Requirements:
- Node `>= 20.11`
- pnpm `>= 9`

```sh
pnpm install
cp .env.example .env
pnpm dev
```

Dev services:
- Web: `http://localhost:5173`
- Render service: `http://localhost:8787`
- Auth service: `http://127.0.0.1:4000` (reached by browser through `/api/auth` proxy)
- AI service: `http://127.0.0.1:4100` (reached by browser through `/api/ai` proxy)

## Common scripts

```sh
pnpm dev
pnpm dev:web
pnpm dev:render
pnpm dev:auth
pnpm dev:ai

pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm codegen
```

## Repo layout

```txt
apps/
  web/
  render-service/
  auth-service/
  ai-service/

packages/
  transformer/
  graphql-client/
  themes/
  ai-contracts/
  vendor/

docs/
  ARCHITECTURE.md
  FUNCTIONAL_REQUIREMENTS.md
  SAVE_PIPELINE.md
  DOMAIN_RELATIONSHIP.md
  LOCAL_DEV.md
  DEPLOYMENT.md
  CONTRIBUTING.md
  KNOWN_ISSUES.md
```

## Documentation map

- System design: `docs/ARCHITECTURE.md`
- Feature requirements and file touchpoints: `docs/FUNCTIONAL_REQUIREMENTS.md`
- Save planner/executor details: `docs/SAVE_PIPELINE.md`
- Domain/schema mapping notes: `docs/DOMAIN_RELATIONSHIP.md`
- Local setup and auth wiring: `docs/LOCAL_DEV.md`
- Deployment: `docs/DEPLOYMENT.md`
- Open constraints/risks: `docs/KNOWN_ISSUES.md`

## License

See `LICENSE`.
