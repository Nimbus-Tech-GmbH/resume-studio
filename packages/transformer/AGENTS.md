# Transformer Instructions

- Keep this package pure TypeScript with no runtime dependencies.
- Preserve browser/Node parity.
- Changes to diff behavior require `toCms.test.ts` coverage.
- Do not import Keystone types.
- Use stable/content-based matching for repeated entities.
- Keep CMS decoding separate from editor representation.

## Key files

| File | Purpose |
|---|---|
| `src/types.ts` | `JsonResume*` (editor) + `Cms*` (CMS) interfaces |
| `src/fromCms.ts` | CMS → JSON Resume (load) |
| `src/toCms.ts` | JSON Resume diff → `MutationOp[]` (save planner) |
| `src/toCms.test.ts` | Planner tests — add coverage for every new diff behavior |

## Debugging tips

- **Diff issues**: Trace the specific `diff*` function in `toCms.ts`; compare current vs original with originalCms and cmsIds
- **Load issues**: Check `fromCms.ts` decoders handle null/undefined; verify `Cms*` interfaces match GraphQL response shape
- **Type issues**: This package has no Keystone deps; `schema.ts` in root is the only Keystone-typed file (ESLint ignores it)

## Special entity mappings

- `work.highlights` → separate `ResumeHighlight` row ops
- `certificates` → `ResumeCertification` join table (create/disconnect via `updateResume`)
- `basics.location` → separate `ResumeLocation` row ops
- `basics.profiles` → separate `ResumeProfile` row ops
- `basics.image` → relation payload `{ create: { src } }` or `{ disconnect: true }`

## Project-specific skills

- Use `caveman` for all conversations until specifically requested otherwise.
