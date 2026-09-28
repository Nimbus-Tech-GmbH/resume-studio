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

Components live in `apps/web/src/components/ui/` and are managed via the shadcn CLI (config: `apps/web/components.json`, style `radix-mira`):

```sh
cd apps/web
pnpm dlx shadcn@latest add <component>
```

When updating an existing component, preview with `--dry-run` / `--diff` first and merge — don't blind-overwrite local changes. **Tailwind here is v4** (`apps/web/src/index.css`, `@import "tailwindcss"`), so registry classes apply as-is. Design tokens are the CSS variables in `index.css`, mapped to utilities via `@theme` — extend the `@theme` block, don't add hacks to components. See FUNCTIONAL_REQUIREMENTS FR-12 for the full checklist.

Design tokens in `apps/web/src/index.css` are CSS variables consumed by the Tailwind v4 `@theme` block (`--color-*` referencing `--background` etc.). Keep values as oklch there — do not introduce a `tailwind.config.ts` or `hsl(var())` wrapping.

## Adding a new resume section

1. Extend `JsonResume*` types in `packages/transformer/src/types.ts`.
2. Update `fromCms` and `toCms` diff logic.
3. Add a section component under `apps/web/src/editor/sections/`.
4. Register it in `EditorPane.tsx`.
5. Add unit tests to `packages/transformer/src/*.test.ts`.

Full step-by-step recipes (including CMS-select dropdown fields and validation) are in [`FUNCTIONAL_REQUIREMENTS.md`](./FUNCTIONAL_REQUIREMENTS.md), Appendices A/B.

## Adding a new theme

1. Vendor the theme under `packages/vendor` (themes are committed in-repo, not
   npm-installed, so preview output is pinned).
2. Add it to `THEMES` in `packages/themes/src/registry.ts`.
3. Add a lazy `import()` loader for it in the `loaders` map in `packages/themes/src/themes.ts`.
4. Verify preview against a known resume — some themes are picky about optional fields.

## Milestone tracker

Post-MVP work happens on GitHub issues.

## Code review checklist

- Types compile.
- Tests added / updated.
- Lint clean (`pnpm lint`).
- No `console.log` left behind (Fastify uses `req.log`; browser uses TanStack devtools).
- No secrets in commits (`.env` is gitignored; use `.env.example`).
- Loading states use shadcn `Skeleton` / `Spinner` — no ad-hoc spinners.
- New shadcn components audited against Tailwind v4 (see above).
