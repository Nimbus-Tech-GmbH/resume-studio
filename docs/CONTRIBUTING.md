# Contributing

Keep changes small, typed, and verifiable.

## Baseline rules

- TypeScript strict mode conventions apply.
- Prefer no `any` in new code.
- Run before PR:

```sh
pnpm typecheck
pnpm lint
pnpm test
```

- Keep scope tight; split broad changes.

---

## Workflow

```sh
git checkout -b feat/short-description
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build   # recommended before push
```

Commit style: Conventional Commits.

---

## UI components (shadcn + Tailwind v4)

- UI primitives live in `apps/web/src/components/ui/`.
- Manage components via shadcn CLI:

```sh
cd apps/web
pnpm dlx shadcn@latest add <component>
```

- For updates, use `--dry-run` / `--diff` and merge intentionally.
- Tailwind is v4; design tokens live in `apps/web/src/index.css` and are mapped via `@theme`.
- Do not introduce Tailwind v3-era config/syntax.

---

## Common change recipes

### Add a resume section

1. Update transformer types (`packages/transformer/src/types.ts`)
2. Update `fromCms` / `toCms`
3. Add section UI under `apps/web/src/editor/sections/`
4. Register section in `EditorPane.tsx`
5. Add/adjust tests

See `docs/FUNCTIONAL_REQUIREMENTS.md` appendices for full recipes.

### Add a theme

1. Vendor under `packages/vendor`
2. Register in `packages/themes/src/registry.ts`
3. Add lazy loader in `packages/themes/src/themes.ts`
4. Verify preview using realistic resume data

---

## Review checklist

- Types compile
- Tests updated where behavior changed
- Lint clean
- No secrets committed
- Loading states use shared UI primitives (`Skeleton`/`Spinner`)
