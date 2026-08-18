/**
 * JSON Resume → CMS mutation plan.
 *
 * Scope for milestone 7:
 *  - Diff basics scalars (excluding `image`, MVP read-only).
 *  - Diff list-encoded fields (skills.keywords, interests.keywords,
 *    volunteer.highlights, education.courses, projects.highlights) via `listCodec`.
 *  - Diff `work[].highlights` as CMS relation rows (create / update / delete + order).
 *  - Reject invalid dates.
 *
 * Not yet handled (add in follow-ups):
 *  - Reordering top-level lists (work / education / skills) — the current diff
 *    keeps the caller responsible for matching by id; ordering is expressed
 *    via `updateResume { <section>: { set: [...] } }` ops which we emit here.
 *  - Creating/deleting top-level list rows. The load flow assigns ids in
 *    fromCms, so unknown-id rows are surfaced as ops but callers should treat
 *    creates/deletes conservatively (blocked with an error until M7.5).
 */

import { encodeDate, isValidDateInput } from './dateCodec.js';
import { encodeList } from './listCodec.js';
import { diffScalars, reorderSet } from './diff.js';
import type {
  CmsHighlight,
  CmsResume,
  JsonResume,
  JsonResumeBasics,
  JsonResumeWork,
} from './types.js';

export type MutationOp =
  | { kind: 'updateResumeBasicInformation'; id: string; data: Record<string, unknown> }
  | { kind: 'updateResumeWork'; id: string; data: Record<string, unknown> }
  | { kind: 'createResumeHighlight'; data: Record<string, unknown> }
  | { kind: 'updateResumeHighlight'; id: string; data: Record<string, unknown> }
  | { kind: 'deleteResumeHighlight'; id: string }
  | { kind: 'updateResumeSkill'; id: string; data: Record<string, unknown> }
  | { kind: 'updateResumeInterest'; id: string; data: Record<string, unknown> }
  | { kind: 'updateResumeEducation'; id: string; data: Record<string, unknown> }
  | { kind: 'updateResumeVolunteer'; id: string; data: Record<string, unknown> }
  | { kind: 'updateResumeProject'; id: string; data: Record<string, unknown> }
  | { kind: 'updateCertification'; id: string; data: Record<string, unknown> }
  | { kind: 'updateResume'; id: string; data: Record<string, unknown> };

export interface ValidationError {
  path: string;
  message: string;
}

export interface MutationPlan {
  ops: MutationOp[];
  errors: ValidationError[];
}

export interface ToCmsInput {
  current: JsonResume;
  original: JsonResume;
  originalCms: CmsResume;
}

const DATE_FIELDS: readonly string[] = ['startDate', 'endDate', 'date'];

/**
 * Build a mutation plan for the delta between `current` and `original`.
 * `originalCms` is required to resolve stable ids for update ops.
 */
export function toCms(input: ToCmsInput): MutationPlan {
  const ops: MutationOp[] = [];
  const errors: ValidationError[] = [];

  diffBasics(input, ops, errors);
  diffSkills(input, ops, errors);
  diffInterests(input, ops, errors);
  diffEducation(input, ops, errors);
  diffVolunteer(input, ops, errors);
  diffProjects(input, ops, errors);
  diffCertificates(input, ops, errors);
  diffWork(input, ops, errors);

  return { ops, errors };
}

// ─── basics ──────────────────────────────────────────────────────────────

function diffBasics(input: ToCmsInput, ops: MutationOp[], errors: ValidationError[]): void {
  const cur = input.current.basics;
  const orig = input.original.basics;
  const cmsBi = input.originalCms.basicInformation;
  if (!cmsBi) return;

  const flatCur = flattenBasics(cur);
  const flatOrig = flattenBasics(orig);
  const changed = diffScalars(flatCur, flatOrig);
  if (Object.keys(changed).length === 0) return;

  // basics has no date fields but keep the guard structure symmetrical.
  const data: Record<string, unknown> = { ...changed };
  if (Object.keys(data).length > 0) {
    ops.push({ kind: 'updateResumeBasicInformation', id: cmsBi.id, data });
  }
  void errors;
}

function flattenBasics(basics: JsonResumeBasics | undefined): Record<string, unknown> {
  if (!basics) return {};
  const { location, profiles, image, ...rest } = basics;
  return {
    ...rest,
    address: location?.address,
    postalCode: location?.postalCode,
    city: location?.city,
    countryCode: location?.countryCode,
    region: location?.region,
    // `image` and `profiles` are relations — out of scope for MVP save.
    _image: image,
    _profiles: profiles,
  };
}

// ─── list-encoded fields ─────────────────────────────────────────────────

function diffSkills(input: ToCmsInput, ops: MutationOp[], errors: ValidationError[]): void {
  const current = input.current.skills ?? [];
  const original = input.original.skills ?? [];
  const cms = input.originalCms.skills ?? [];
  for (let i = 0; i < current.length; i += 1) {
    const c = current[i];
    const o = original[i];
    const id = cms[i]?.id;
    if (!id || !c) continue;
    const data: Record<string, unknown> = {};
    if (c.name !== o?.name) data.name = c.name;
    if (c.level !== o?.level) data.level = c.level;
    const curKeywords = encodeList(c.keywords);
    const origKeywords = encodeList(o?.keywords);
    if (curKeywords !== origKeywords) data.keywords = curKeywords;
    if (Object.keys(data).length > 0) {
      ops.push({ kind: 'updateResumeSkill', id, data });
    }
  }
  void errors;
}

function diffInterests(input: ToCmsInput, ops: MutationOp[], errors: ValidationError[]): void {
  const current = input.current.interests ?? [];
  const original = input.original.interests ?? [];
  const cms = input.originalCms.interests ?? [];
  for (let i = 0; i < current.length; i += 1) {
    const c = current[i];
    const o = original[i];
    const id = cms[i]?.id;
    if (!id || !c) continue;
    const data: Record<string, unknown> = {};
    if (c.name !== o?.name) data.name = c.name;
    const cur = encodeList(c.keywords);
    const orig = encodeList(o?.keywords);
    if (cur !== orig) data.keywords = cur;
    if (Object.keys(data).length > 0) {
      ops.push({ kind: 'updateResumeInterest', id, data });
    }
  }
  void errors;
}

function diffEducation(input: ToCmsInput, ops: MutationOp[], errors: ValidationError[]): void {
  const current = input.current.education ?? [];
  const original = input.original.education ?? [];
  const cms = input.originalCms.education ?? [];
  for (let i = 0; i < current.length; i += 1) {
    const c = current[i];
    const o = original[i];
    const id = cms[i]?.id;
    if (!id || !c) continue;
    const data: Record<string, unknown> = {};
    for (const key of ['institution', 'url', 'area', 'studyType', 'score'] as const) {
      if (c[key] !== o?.[key]) data[key] = c[key];
    }
    for (const key of ['startDate', 'endDate'] as const) {
      if (c[key] !== o?.[key]) {
        if (!isValidDateInput(c[key])) {
          errors.push({ path: `education[${i}].${key}`, message: `Invalid date: ${c[key]}` });
        } else {
          data[key] = encodeDate(c[key]);
        }
      }
    }
    const cur = encodeList(c.courses);
    const orig = encodeList(o?.courses);
    if (cur !== orig) data.courses = cur;
    if (Object.keys(data).length > 0) {
      ops.push({ kind: 'updateResumeEducation', id, data });
    }
  }
}

function diffVolunteer(input: ToCmsInput, ops: MutationOp[], errors: ValidationError[]): void {
  const current = input.current.volunteer ?? [];
  const original = input.original.volunteer ?? [];
  const cms = input.originalCms.volunteer ?? [];
  for (let i = 0; i < current.length; i += 1) {
    const c = current[i];
    const o = original[i];
    const id = cms[i]?.id;
    if (!id || !c) continue;
    const data: Record<string, unknown> = {};
    for (const key of ['organization', 'position', 'url', 'summary'] as const) {
      if (c[key] !== o?.[key]) data[key] = c[key];
    }
    for (const key of ['startDate', 'endDate'] as const) {
      if (c[key] !== o?.[key]) {
        if (!isValidDateInput(c[key])) {
          errors.push({ path: `volunteer[${i}].${key}`, message: `Invalid date: ${c[key]}` });
        } else {
          data[key] = encodeDate(c[key]);
        }
      }
    }
    const cur = encodeList(c.highlights);
    const orig = encodeList(o?.highlights);
    if (cur !== orig) data.highlights = cur;
    if (Object.keys(data).length > 0) {
      ops.push({ kind: 'updateResumeVolunteer', id, data });
    }
  }
}

function diffProjects(input: ToCmsInput, ops: MutationOp[], errors: ValidationError[]): void {
  const current = input.current.projects ?? [];
  const original = input.original.projects ?? [];
  const cms = input.originalCms.projects ?? [];
  for (let i = 0; i < current.length; i += 1) {
    const c = current[i];
    const o = original[i];
    const id = cms[i]?.id;
    if (!id || !c) continue;
    const data: Record<string, unknown> = {};
    for (const key of ['name', 'description', 'url'] as const) {
      if (c[key] !== o?.[key]) data[key] = c[key];
    }
    for (const key of ['startDate', 'endDate'] as const) {
      if (c[key] !== o?.[key]) {
        if (!isValidDateInput(c[key])) {
          errors.push({ path: `projects[${i}].${key}`, message: `Invalid date: ${c[key]}` });
        } else {
          data[key] = encodeDate(c[key]);
        }
      }
    }
    for (const key of ['highlights', 'keywords'] as const) {
      const cur = encodeList(c[key]);
      const orig = encodeList(o?.[key]);
      if (cur !== orig) data[key] = cur;
    }
    if (Object.keys(data).length > 0) {
      ops.push({ kind: 'updateResumeProject', id, data });
    }
  }
}

function diffCertificates(
  input: ToCmsInput,
  ops: MutationOp[],
  errors: ValidationError[],
): void {
  const current = input.current.certificates ?? [];
  const original = input.original.certificates ?? [];
  const cms = input.originalCms.certifications ?? [];
  for (let i = 0; i < current.length; i += 1) {
    const c = current[i];
    const o = original[i];
    const id = cms[i]?.id;
    if (!id || !c) continue;
    const data: Record<string, unknown> = {};
    if (c.name !== o?.name) data.title = c.name;
    if (c.issuer !== o?.issuer) data.issuer = c.issuer;
    if (c.url !== o?.url) data.link = c.url;
    if (c.summary !== o?.summary) data.description = c.summary;
    if (c.date !== o?.date) {
      if (!isValidDateInput(c.date)) {
        errors.push({ path: `certificates[${i}].date`, message: `Invalid date: ${c.date}` });
      } else {
        data.date = encodeDate(c.date);
      }
    }
    if (Object.keys(data).length > 0) {
      ops.push({ kind: 'updateCertification', id, data });
    }
  }
}

// ─── work + highlights (relation) ────────────────────────────────────────

function diffWork(input: ToCmsInput, ops: MutationOp[], errors: ValidationError[]): void {
  const current = input.current.work ?? [];
  const original = input.original.work ?? [];
  const cms = input.originalCms.work ?? [];
  for (let i = 0; i < current.length; i += 1) {
    const c = current[i];
    const o = original[i];
    const cmsWork = cms[i];
    if (!cmsWork || !c) continue;

    const data: Record<string, unknown> = {};
    for (const key of ['name', 'position', 'url', 'summary'] as const) {
      if (c[key] !== o?.[key]) data[key] = c[key];
    }
    for (const key of DATE_FIELDS as readonly ('startDate' | 'endDate')[]) {
      const cv = (c as JsonResumeWork)[key];
      const ov = (o as JsonResumeWork | undefined)?.[key];
      if (cv !== ov) {
        if (!isValidDateInput(cv)) {
          errors.push({ path: `work[${i}].${key}`, message: `Invalid date: ${cv}` });
        } else {
          data[key] = encodeDate(cv);
        }
      }
    }
    if (Object.keys(data).length > 0) {
      ops.push({ kind: 'updateResumeWork', id: cmsWork.id, data });
    }

    // Highlights: create / update / delete + reorder via set.
    diffHighlights({
      workId: cmsWork.id,
      current: c.highlights ?? [],
      original: o?.highlights ?? [],
      cmsHighlights: cmsWork.highlights ?? [],
      workPath: `work[${i}].highlights`,
      ops,
    });
  }
}

interface DiffHighlightsArgs {
  workId: string;
  current: readonly string[];
  original: readonly string[];
  cmsHighlights: readonly CmsHighlight[];
  workPath: string;
  ops: MutationOp[];
}

function diffHighlights(args: DiffHighlightsArgs): void {
  const { workId, current, original, cmsHighlights, ops } = args;

  // Pair current highlight strings positionally with existing CMS rows to
  // detect updates. This assumes fromCms preserves order (it does — sortByOrder).
  const usedIds = new Set<string>();
  const finalOrder: Array<{ id: string } | { placeholder: number }> = [];

  for (let i = 0; i < current.length; i += 1) {
    const value = current[i];
    const cmsRow = cmsHighlights[i];
    if (cmsRow?.id) {
      usedIds.add(cmsRow.id);
      if (value !== original[i]) {
        ops.push({
          kind: 'updateResumeHighlight',
          id: cmsRow.id,
          data: { value, order: i },
        });
      } else if ((cmsRow.order ?? 0) !== i) {
        ops.push({
          kind: 'updateResumeHighlight',
          id: cmsRow.id,
          data: { order: i },
        });
      }
      finalOrder.push({ id: cmsRow.id });
    } else {
      ops.push({
        kind: 'createResumeHighlight',
        data: { value, order: i, work: { connect: { id: workId } } },
      });
      finalOrder.push({ placeholder: i });
    }
  }

  for (const row of cmsHighlights) {
    if (row.id && !usedIds.has(row.id)) {
      ops.push({ kind: 'deleteResumeHighlight', id: row.id });
    }
  }

  // Emit ordered `set` only when reorder is genuinely different.
  const currentIdOrder = cmsHighlights.map((h) => h.id);
  const reorderIds = finalOrder
    .filter((x): x is { id: string } => 'id' in x)
    .map((x) => x.id);
  const setChanged = reorderSet(
    reorderIds.map((id) => ({ id })),
    currentIdOrder.map((id) => ({ id })),
  );
  if (setChanged) {
    ops.push({
      kind: 'updateResumeWork',
      id: workId,
      data: { highlights: { set: setChanged } },
    });
  }
}
