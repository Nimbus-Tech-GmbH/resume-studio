/**
 * JSON Resume → CMS mutation plan.
 *
 * Diffs current `JsonResume` vs the last-loaded snapshot and emits typed ops
 * that map 1:1 onto Keystone mutations.
 *
 * Constraints imposed by the real Keystone schema (see PLAN §10.2):
 *   - No `order` field on any relation → reorder is not persistable in MVP.
 *   - `basics.location` is a separate `ResumeLocation` relation → its scalar
 *     changes need a dedicated `updateResumeLocation` op.
 *   - `Certification` exposes only `{title, description, link}` — no date /
 *     issuer, so those fields are silently dropped.
 */

import { encodeDate, isValidDateInput } from './dateCodec.js';
import { encodeList } from './listCodec.js';
import { diffScalars } from './diff.js';
import type {
  CmsHighlight,
  CmsResume,
  JsonResume,
  JsonResumeBasics,
  JsonResumeWork,
} from './types.js';

export type MutationOp =
  | { kind: 'updateResumeBasicInformation'; id: string; data: Record<string, unknown> }
  | { kind: 'updateResumeLocation'; id: string; data: Record<string, unknown> }
  | { kind: 'updateResumeWork'; id: string; data: Record<string, unknown> }
  | { kind: 'createResumeHighlight'; data: Record<string, unknown> }
  | { kind: 'updateResumeHighlight'; id: string; data: Record<string, unknown> }
  | { kind: 'deleteResumeHighlight'; id: string }
  | { kind: 'updateResumeSkill'; id: string; data: Record<string, unknown> }
  | { kind: 'updateResumeInterest'; id: string; data: Record<string, unknown> }
  | { kind: 'updateResumeEducation'; id: string; data: Record<string, unknown> }
  | { kind: 'updateResumeVolunteer'; id: string; data: Record<string, unknown> }
  | { kind: 'updateResumeProject'; id: string; data: Record<string, unknown> }
  | { kind: 'updateResumeLanguage'; id: string; data: Record<string, unknown> }
  | { kind: 'updateCertification'; id: string; data: Record<string, unknown> };

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

export function toCms(input: ToCmsInput): MutationPlan {
  const ops: MutationOp[] = [];
  const errors: ValidationError[] = [];

  diffBasics(input, ops);
  diffLocation(input, ops);
  diffSkills(input, ops);
  diffInterests(input, ops);
  diffEducation(input, ops, errors);
  diffVolunteer(input, ops, errors);
  diffProjects(input, ops, errors);
  diffCertificates(input, ops);
  diffLanguages(input, ops);
  diffWork(input, ops, errors);

  return { ops, errors };
}

// ─── basics scalars (excluding location, which lives on its own relation) ─

function diffBasics(input: ToCmsInput, ops: MutationOp[]): void {
  const cur = input.current.basics;
  const orig = input.original.basics;
  const cmsBi = input.originalCms.basicInformation;
  if (!cmsBi) return;
  const changed = diffScalars(flattenBasics(cur), flattenBasics(orig));
  if (Object.keys(changed).length > 0) {
    ops.push({ kind: 'updateResumeBasicInformation', id: cmsBi.id, data: changed });
  }
}

function flattenBasics(basics: JsonResumeBasics | undefined): Record<string, unknown> {
  if (!basics) return {};
  const { location, profiles, image, ...rest } = basics;
  void location;
  void profiles;
  void image;
  return { ...rest };
}

function diffLocation(input: ToCmsInput, ops: MutationOp[]): void {
  const cur = input.current.basics?.location;
  const orig = input.original.basics?.location;
  const cmsLoc = input.originalCms.basicInformation?.location;
  if (!cmsLoc) return; // MVP: cannot create a location; would need connect/create nesting
  const changed = diffScalars(cur ?? {}, orig ?? {});
  if (Object.keys(changed).length > 0) {
    ops.push({ kind: 'updateResumeLocation', id: cmsLoc.id, data: changed });
  }
}

// ─── list-encoded scalar fields ──────────────────────────────────────────

function diffSkills(input: ToCmsInput, ops: MutationOp[]): void {
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
    const cur = encodeList(c.keywords);
    const orig = encodeList(o?.keywords);
    if (cur !== orig) data.keywords = cur;
    if (Object.keys(data).length > 0) {
      ops.push({ kind: 'updateResumeSkill', id, data });
    }
  }
}

function diffInterests(input: ToCmsInput, ops: MutationOp[]): void {
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
    // Only `highlights` is a list-encoded String on `ResumeProject`; keywords
    // is not present in the CMS schema, so it's edit-only in the UI.
    const cur = encodeList(c.highlights);
    const orig = encodeList(o?.highlights);
    if (cur !== orig) data.highlights = cur;
    if (Object.keys(data).length > 0) {
      ops.push({ kind: 'updateResumeProject', id, data });
    }
  }
}

function diffCertificates(input: ToCmsInput, ops: MutationOp[]): void {
  const current = input.current.certificates ?? [];
  const original = input.original.certificates ?? [];
  const cms = input.originalCms.certificates ?? [];
  for (let i = 0; i < current.length; i += 1) {
    const c = current[i];
    const o = original[i];
    const id = cms[i]?.id;
    if (!id || !c) continue;
    const data: Record<string, unknown> = {};
    if (c.name !== o?.name) data.title = c.name;
    if (c.url !== o?.url) data.link = c.url;
    if (c.summary !== o?.summary) data.description = c.summary;
    // `date` and `issuer` are not represented in the CMS `Certification` type
    // and are silently dropped on save.
    if (Object.keys(data).length > 0) {
      ops.push({ kind: 'updateCertification', id, data });
    }
  }
}

function diffLanguages(input: ToCmsInput, ops: MutationOp[]): void {
  const current = input.current.languages ?? [];
  const original = input.original.languages ?? [];
  const cms = input.originalCms.resumeLanguages ?? [];
  for (let i = 0; i < current.length; i += 1) {
    const c = current[i];
    const o = original[i];
    const id = cms[i]?.id;
    if (!id || !c) continue;
    const data: Record<string, unknown> = {};
    if (c.language !== o?.language) data.language = c.language;
    if (c.fluency !== o?.fluency) data.fluency = c.fluency;
    if (Object.keys(data).length > 0) {
      ops.push({ kind: 'updateResumeLanguage', id, data });
    }
  }
}

// ─── work + highlight relation ───────────────────────────────────────────

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
    for (const key of ['startDate', 'endDate'] as const) {
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

    diffHighlights({
      workId: cmsWork.id,
      current: c.highlights ?? [],
      original: o?.highlights ?? [],
      cmsHighlights: cmsWork.highlights ?? [],
      ops,
    });
  }
}

interface DiffHighlightsArgs {
  workId: string;
  current: readonly string[];
  original: readonly string[];
  cmsHighlights: readonly CmsHighlight[];
  ops: MutationOp[];
}

function diffHighlights(args: DiffHighlightsArgs): void {
  const { workId, current, original, cmsHighlights, ops } = args;
  const usedIds = new Set<string>();

  for (let i = 0; i < current.length; i += 1) {
    const value = current[i];
    const cmsRow = cmsHighlights[i];
    if (cmsRow?.id) {
      usedIds.add(cmsRow.id);
      if (value !== original[i]) {
        ops.push({ kind: 'updateResumeHighlight', id: cmsRow.id, data: { value } });
      }
    } else {
      ops.push({
        kind: 'createResumeHighlight',
        data: { value, work: { connect: { id: workId } } },
      });
    }
  }

  for (const row of cmsHighlights) {
    if (row.id && !usedIds.has(row.id)) {
      ops.push({ kind: 'deleteResumeHighlight', id: row.id });
    }
  }
}
