# Contributing

Thanks for helping! Keep it small, keep it typed.

## Ground rules

- TypeScript strict everywhere. No `any` in new code unless you leave a comment explaining why.
- Prettier formats on save; ESLint is intentionally deferred (add per-package as we go).
- Run `pnpm typecheck && pnpm test` before opening a PR.
- Keep changes scoped. If a PR touches more than three packages, split it.

## Workflow

```sh
git checkout -b feat/short-description
pnpm install
pnpm typecheck
pnpm test
pnpm build   # optional but recommended before pushing
```

Commit style: [Conventional Commits](https://www.conventionalcommits.org/). Examples:

- `feat(editor): add DnD reorder for education`
- `fix(transformer): treat empty string as null in scalar diff`
- `docs: document RENDER_CACHE_MAX default`

## Adding a new resume section

1. Extend `JsonResume*` types in `packages/transformer/src/types.ts`.
2. Update `fromCms` and `toCms` diff logic.
3. Add a section component under `apps/web/src/editor/sections/`.
4. Register it in `EditorPane.tsx`.
5. Add unit tests to `packages/transformer/src/*.test.ts`.

## Adding a new theme

1. Install the theme package under `packages/themes` and `apps/render-service`.
2. Add it to `THEMES` in `packages/themes/src/registry.ts`.
3. Add a lazy `import()` loader for it in the `loaders` map in `packages/themes/src/themes.ts`.
4. Verify preview against a known resume — some themes are picky about optional fields.

## Milestone tracker

See [`PLAN.md`](../PLAN.md) for the historical roadmap. Post-MVP work happens on GitHub issues.

## Code review checklist

- Types compile.
- Tests added / updated.
- No `console.log` left behind (Fastify uses `req.log`; browser uses TanStack devtools).
- No secrets in commits (`.env` is gitignored; use `.env.example`).
