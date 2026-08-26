# Contributing

Thanks for helping! Keep it small, keep it typed.

## Ground rules

- TypeScript strict everywhere. No `any` in new code unless you leave a comment explaining why.
- Prettier formats on save; ESLint runs from the root flat config (`pnpm lint`).
- Run `pnpm typecheck && pnpm lint && pnpm test` before opening a PR.
- Keep changes scoped. If a PR touches more than three packages, split it.

## Workflow

```sh
git checkout -b feat/short-description
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build   # optional but recommended before pushing
```

Commit style: [Conventional Commits](https://www.conventionalcommits.org/). Examples:

- `feat(editor): add DnD reorder for education`
- `fix(transformer): treat empty string as null in scalar diff`
- `docs: document RENDER_CACHE_MAX default`

## UI components (shadcn/ui)

Components live in `apps/web/src/components/ui/` and are managed via the shadcn CLI (config: `apps/web/components.json`, radix base):

```sh
cd apps/web
pnpm dlx shadcn@latest add <component>
```

When updating an existing component, preview with `--dry-run` / `--diff` first and merge — don't blind-overwrite local changes. **Tailwind here is v3**, but the registry targets v4: after adding/updating, rewrite v4-only classes (`gap-(--x)`, `rounded-4xl`, `field-sizing-content`, `data-active:`, `ring-3`, `size-4!`) to v3 equivalents, then verify the class actually appears in `dist/assets/*.css` after `pnpm build`. See FUNCTIONAL_REQUIREMENTS FR-12 for the full checklist.

Design tokens in `apps/web/src/index.css` must stay HSL triplets (`tailwind.config.ts` wraps them in `hsl(var(--x))`) — raw oklch values silently break borders/colors.

## Adding a new resume section

1. Extend `JsonResume*` types in `packages/transformer/src/types.ts`.
2. Update `fromCms` and `toCms` diff logic.
3. Add a section component under `apps/web/src/editor/sections/`.
4. Register it in `EditorPane.tsx`.
5. Add unit tests to `packages/transformer/src/*.test.ts`.

Full step-by-step recipes (including CMS-select dropdown fields and validation) are in [`FUNCTIONAL_REQUIREMENTS.md`](./FUNCTIONAL_REQUIREMENTS.md), Appendices A/B.

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
- Lint clean (`pnpm lint`).
- No `console.log` left behind (Fastify uses `req.log`; browser uses TanStack devtools).
- No secrets in commits (`.env` is gitignored; use `.env.example`).
- Loading states use shadcn `Skeleton` / `Spinner` — no ad-hoc spinners.
- New shadcn components audited for Tailwind v3 compatibility (see above).
