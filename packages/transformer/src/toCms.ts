/**
 * JSON Resume → CMS mutation plan.
 *
 * Handles full CRUD:
 *   - basics scalars                 → updateResumeBasicInformation
 *   - basics.location scalars        → updateResumeLocation
 *   - list section field edits       → updateResumeXxx / updateCertification
 *   - list section create            → createResumeXxx (or updateResume for
 *                                       certificates via connect/create)
 *   - list section delete            → deleteResumeXxx (or updateResume for
 *                                       certificates via disconnect)
 *   - work highlight CRUD            → createResumeHighlight,
 *                                       updateResumeHighlight,
 *                                       deleteResumeHighlight
 *
 * Constraints (see PLAN §10.2):
 *   - No `order` field on any list. Reorder is UI-only.
 *   - `Certification` is a shared list not owned by Resume; create/delete goes
 *     through `updateResume { certificates: { create / disconnect } }`.
 *   - `Certification` has no `date` / `issuer`, so those are dropped.
 */

import { encodeDate, isValidDateInput } from './dateCodec';
import { encodeList } from './listCodec';
import { diffScalars } from './diff';
import type {
  CmsHighlight,
  CmsResume,
  JsonResume,
  JsonResumeBasics,
  JsonResumeCertificate,
  JsonResumeEducation,
  JsonResumeInterest,
  JsonResumeLanguage,
  JsonResumeProject,
  JsonResumeSkill,
  JsonResumeVolunteer,
  JsonResumeWork,
} from './types';

// ─── op union ────────────────────────────────────────────────────────────

export type MutationOp =
  | { kind: 'updateResumeBasicInformation'; id: string; data: Record<string, unknown> }
  | { kind: 'updateResumeLocation'; id: string; data: Record<string, unknown> }
  | { kind: 'updateResumeWork'; id: string; data: Record<string, unknown> }
  | { kind: 'createResumeWork'; data: Record<string, unknown> }
  | { kind: 'deleteResumeWork'; id: string }
  | { kind: 'createResumeHighlight'; data: Record<string, unknown> }
  | { kind: 'updateResumeHighlight'; id: string; data: Record<string, unknown> }
  | { kind: 'deleteResumeHighlight'; id: string }
  | { kind: 'updateResumeSkill'; id: string; data: Record<string, unknown> }
  | { kind: 'createResumeSkill'; data: Record<string, unknown> }
  | { kind: 'deleteResumeSkill'; id: string }
  | { kind: 'updateResumeInterest'; id: string; data: Record<string, unknown> }
  | { kind: 'createResumeInterest'; data: Record<string, unknown> }
  | { kind: 'deleteResumeInterest'; id: string }
  | { kind: 'updateResumeEducation'; id: string; data: Record<string, unknown> }
  | { kind: 'createResumeEducation'; data: Record<string, unknown> }
  | { kind: 'deleteResumeEducation'; id: string }
  | { kind: 'updateResumeVolunteer'; id: string; data: Record<string, unknown> }
  | { kind: 'createResumeVolunteer'; data: Record<string, unknown> }
  | { kind: 'deleteResumeVolunteer'; id: string }
  | { kind: 'updateResumeProject'; id: string; data: Record<string, unknown> }
  | { kind: 'createResumeProject'; data: Record<string, unknown> }
  | { kind: 'deleteResumeProject'; id: string }
  | { kind: 'updateResumeLanguage'; id: string; data: Record<string, unknown> }
  | { kind: 'createResumeLanguage'; data: Record<string, unknown> }
  | { kind: 'deleteResumeLanguage'; id: string }
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

/**
 * Parallel arrays of CMS ids for each editable list section, mirroring the
 * current shape of `JsonResume`. `null` at position i means "row added
 * locally". Rows removed locally are already absent from these arrays;
 * deletes are computed by comparing against `originalCmsIds`.
 */
export interface CmsIdMap {
  work: Array<string | null>;
  education: Array<string | null>;
  skills: Array<string | null>;
  interests: Array<string | null>;
  volunteer: Array<string | null>;
  projects: Array<string | null>;
  certificates: Array<string | null>;
  languages: Array<string | null>;
}

export interface ToCmsInput {
  current: JsonResume;
  original: JsonResume;
  originalCms: CmsResume;
  cmsIds: CmsIdMap;
  originalCmsIds: CmsIdMap;
  resumeId: string;
}

// ─── public entry ────────────────────────────────────────────────────────

export function toCms(input: ToCmsInput): MutationPlan {
  const ops: MutationOp[] = [];
  const errors: ValidationError[] = [];

  diffBasics(input, ops);
  diffLocation(input, ops);
  diffWork(input, ops, errors);
  diffSection(input, ops, errors, {
    section: 'education',
    encode: encodeEducation,
    createKind: 'createResumeEducation',
    updateKind: 'updateResumeEducation',
    deleteKind: 'deleteResumeEducation',
  });
  diffSection(input, ops, errors, {
    section: 'skills',
    encode: encodeSkill,
    createKind: 'createResumeSkill',
    updateKind: 'updateResumeSkill',
    deleteKind: 'deleteResumeSkill',
  });
  diffSection(input, ops, errors, {
    section: 'interests',
    encode: encodeInterest,
    createKind: 'createResumeInterest',
    updateKind: 'updateResumeInterest',
    deleteKind: 'deleteResumeInterest',
  });
  diffSection(input, ops, errors, {
    section: 'volunteer',
    encode: encodeVolunteer,
    createKind: 'createResumeVolunteer',
    updateKind: 'updateResumeVolunteer',
    deleteKind: 'deleteResumeVolunteer',
  });
  diffSection(input, ops, errors, {
    section: 'projects',
    encode: encodeProject,
    createKind: 'createResumeProject',
    updateKind: 'updateResumeProject',
    deleteKind: 'deleteResumeProject',
  });
  diffSection(input, ops, errors, {
    section: 'languages',
    encode: encodeLanguage,
    createKind: 'createResumeLanguage',
    updateKind: 'updateResumeLanguage',
    deleteKind: 'deleteResumeLanguage',
  });
  diffCertificates(input, ops);

  return { ops, errors };
}

// ─── basics + location ───────────────────────────────────────────────────

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
  const { location, profiles, image: _image, ...rest } = basics;
  void location;
  void profiles;
  // `image` stays excluded: the CMS stores it as an Image *relation*, and the
  // exact update-input shape ({ create: { src } } vs { connect }) is unverified
  // until codegen runs against live Keystone. Editing the URL works for preview
  // only; persisting it needs the real ResumeBasicInformationUpdateInput.
  return { ...rest };
}

function diffLocation(input: ToCmsInput, ops: MutationOp[]): void {
  const cur = input.current.basics?.location;
  const orig = input.original.basics?.location;
  const cmsLoc = input.originalCms.basicInformation?.location;
  if (!cmsLoc) return;
  const changed = diffScalars(cur ?? {}, orig ?? {});
  if (Object.keys(changed).length > 0) {
    ops.push({ kind: 'updateResumeLocation', id: cmsLoc.id, data: changed });
  }
}

// ─── generic list section diff ───────────────────────────────────────────

interface SectionSpec<TItem> {
  section: keyof CmsIdMap;
  encode: (
    item: TItem,
    original: TItem | undefined,
    isCreate: boolean,
    errors: ValidationError[],
    path: string,
    resumeId: string,
  ) => Record<string, unknown> | null;
  createKind: MutationOp['kind'] & `create${string}`;
  updateKind: MutationOp['kind'] & `update${string}`;
  deleteKind: MutationOp['kind'] & `delete${string}`;
}

function getSectionList(resume: JsonResume, section: keyof CmsIdMap): unknown[] {
  if (section === 'languages') return (resume.languages ?? []) as unknown[];
  return (resume[section as keyof JsonResume] as unknown[] | undefined) ?? [];
}

function diffSection<TItem>(
  input: ToCmsInput,
  ops: MutationOp[],
  errors: ValidationError[],
  spec: SectionSpec<TItem>,
): void {
  const current = getSectionList(input.current, spec.section) as TItem[];
  const original = getSectionList(input.original, spec.section) as TItem[];
  const liveIds = input.cmsIds[spec.section];
  const originalIds = input.originalCmsIds[spec.section];

  for (let i = 0; i < current.length; i += 1) {
    const item = current[i]!;
    const id = liveIds[i];
    if (id === null || id === undefined) {
      const data = spec.encode(item, undefined, true, errors, `${spec.section}[${i}]`, input.resumeId);
      if (data) {
        ops.push({ kind: spec.createKind, data } as MutationOp);
      }
      continue;
    }
    // Find the matching original by id — position may have shifted from reorder.
    const origIdx = originalIds.indexOf(id);
    const orig = origIdx >= 0 ? original[origIdx] : undefined;
    const data = spec.encode(item, orig, false, errors, `${spec.section}[${i}]`, input.resumeId);
    if (data && Object.keys(data).length > 0) {
      ops.push({ kind: spec.updateKind, id, data } as MutationOp);
    }
  }

  const liveSet = new Set(liveIds.filter((x): x is string => x !== null));
  for (const id of originalIds) {
    if (id !== null && !liveSet.has(id)) {
      ops.push({ kind: spec.deleteKind, id } as MutationOp);
    }
  }
}

// ─── per-section field encoders ──────────────────────────────────────────

function encodeSkill(
  c: JsonResumeSkill,
  o: JsonResumeSkill | undefined,
  isCreate: boolean,
  _errors: ValidationError[],
  _path: string,
  resumeId: string,
): Record<string, unknown> | null {
  const data: Record<string, unknown> = {};
  if (isCreate || c.name !== o?.name) data.name = c.name;
  if (isCreate || c.level !== o?.level) data.level = c.level;
  const curKw = encodeList(c.keywords);
  const origKw = encodeList(o?.keywords);
  if (isCreate || curKw !== origKw) data.keywords = curKw;
  if (isCreate) data.resume = { connect: { id: resumeId } };
  return data;
}

function encodeInterest(
  c: JsonResumeInterest,
  o: JsonResumeInterest | undefined,
  isCreate: boolean,
  _errors: ValidationError[],
  _path: string,
  resumeId: string,
): Record<string, unknown> | null {
  const data: Record<string, unknown> = {};
  if (isCreate || c.name !== o?.name) data.name = c.name;
  const curKw = encodeList(c.keywords);
  const origKw = encodeList(o?.keywords);
  if (isCreate || curKw !== origKw) data.keywords = curKw;
  if (isCreate) data.resume = { connect: { id: resumeId } };
  return data;
}

function encodeEducation(
  c: JsonResumeEducation,
  o: JsonResumeEducation | undefined,
  isCreate: boolean,
  errors: ValidationError[],
  path: string,
  resumeId: string,
): Record<string, unknown> | null {
  const data: Record<string, unknown> = {};
  for (const key of ['institution', 'url', 'area', 'studyType', 'score'] as const) {
    if (isCreate || c[key] !== o?.[key]) data[key] = c[key];
  }
  for (const key of ['startDate', 'endDate'] as const) {
    if (isCreate || c[key] !== o?.[key]) {
      if (!isValidDateInput(c[key])) {
        errors.push({ path: `${path}.${key}`, message: `Invalid date: ${c[key]}` });
      } else {
        data[key] = encodeDate(c[key]);
      }
    }
  }
  const curCourses = encodeList(c.courses);
  const origCourses = encodeList(o?.courses);
  if (isCreate || curCourses !== origCourses) data.courses = curCourses;
  if (isCreate) data.resume = { connect: { id: resumeId } };
  return data;
}

function encodeVolunteer(
  c: JsonResumeVolunteer,
  o: JsonResumeVolunteer | undefined,
  isCreate: boolean,
  errors: ValidationError[],
  path: string,
  resumeId: string,
): Record<string, unknown> | null {
  const data: Record<string, unknown> = {};
  for (const key of ['organization', 'position', 'url', 'summary'] as const) {
    if (isCreate || c[key] !== o?.[key]) data[key] = c[key];
  }
  for (const key of ['startDate', 'endDate'] as const) {
    if (isCreate || c[key] !== o?.[key]) {
      if (!isValidDateInput(c[key])) {
        errors.push({ path: `${path}.${key}`, message: `Invalid date: ${c[key]}` });
      } else {
        data[key] = encodeDate(c[key]);
      }
    }
  }
  const curH = encodeList(c.highlights);
  const origH = encodeList(o?.highlights);
  if (isCreate || curH !== origH) data.highlights = curH;
  if (isCreate) data.resume = { connect: { id: resumeId } };
  return data;
}

function encodeProject(
  c: JsonResumeProject,
  o: JsonResumeProject | undefined,
  isCreate: boolean,
  errors: ValidationError[],
  path: string,
  resumeId: string,
): Record<string, unknown> | null {
  const data: Record<string, unknown> = {};
  for (const key of ['name', 'description', 'url'] as const) {
    if (isCreate || c[key] !== o?.[key]) data[key] = c[key];
  }
  for (const key of ['startDate', 'endDate'] as const) {
    if (isCreate || c[key] !== o?.[key]) {
      if (!isValidDateInput(c[key])) {
        errors.push({ path: `${path}.${key}`, message: `Invalid date: ${c[key]}` });
      } else {
        data[key] = encodeDate(c[key]);
      }
    }
  }
  const curH = encodeList(c.highlights);
  const origH = encodeList(o?.highlights);
  if (isCreate || curH !== origH) data.highlights = curH;
  if (isCreate) data.resume = { connect: { id: resumeId } };
  return data;
}

function encodeLanguage(
  c: JsonResumeLanguage,
  o: JsonResumeLanguage | undefined,
  isCreate: boolean,
  _errors: ValidationError[],
  _path: string,
  resumeId: string,
): Record<string, unknown> | null {
  const data: Record<string, unknown> = {};
  if (isCreate || c.language !== o?.language) data.language = c.language;
  if (isCreate || c.fluency !== o?.fluency) data.fluency = c.fluency;
  if (isCreate) data.resume = { connect: { id: resumeId } };
  return data;
}

// ─── certificates (shared list, handled via updateResume) ────────────────

function diffCertificates(input: ToCmsInput, ops: MutationOp[]): void {
  const current = input.current.certificates ?? [];
  const original = input.original.certificates ?? [];
  const liveIds = input.cmsIds.certificates;
  const originalIds = input.originalCmsIds.certificates;

  const createDatas: Array<Record<string, unknown>> = [];

  for (let i = 0; i < current.length; i += 1) {
    const c = current[i]!;
    const id = liveIds[i];
    if (id === null || id === undefined) {
      createDatas.push(encodeCertificate(c, undefined, true));
      continue;
    }
    const origIdx = originalIds.indexOf(id);
    const o = origIdx >= 0 ? original[origIdx] : undefined;
    const data = encodeCertificate(c, o, false);
    if (Object.keys(data).length > 0) {
      ops.push({ kind: 'updateCertification', id, data });
    }
  }

  const liveSet = new Set(liveIds.filter((x): x is string => x !== null));
  const disconnectIds = originalIds.filter(
    (id): id is string => id !== null && !liveSet.has(id),
  );

  if (createDatas.length > 0 || disconnectIds.length > 0) {
    const nested: Record<string, unknown> = {};
    if (createDatas.length > 0) nested.create = createDatas;
    if (disconnectIds.length > 0) {
      nested.disconnect = disconnectIds.map((id) => ({ id }));
    }
    ops.push({
      kind: 'updateResume',
      id: input.resumeId,
      data: { certificates: nested },
    });
  }
}

function encodeCertificate(
  c: JsonResumeCertificate,
  o: JsonResumeCertificate | undefined,
  isCreate: boolean,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (isCreate || c.name !== o?.name) data.title = c.name;
  if (isCreate || c.url !== o?.url) data.link = c.url;
  if (isCreate || c.summary !== o?.summary) data.description = c.summary;
  // Certification has no date/issuer fields; silently dropped.
  return data;
}

// ─── work + highlights ───────────────────────────────────────────────────

function diffWork(input: ToCmsInput, ops: MutationOp[], errors: ValidationError[]): void {
  const current = input.current.work ?? [];
  const original = input.original.work ?? [];
  const liveIds = input.cmsIds.work;
  const originalIds = input.originalCmsIds.work;
  const cmsWorkById = new Map(
    (input.originalCms.work ?? []).map((w) => [w.id, w] as const),
  );

  for (let i = 0; i < current.length; i += 1) {
    const item = current[i]!;
    const id = liveIds[i];

    if (id === null || id === undefined) {
      // Create work + include highlights inline via nested create.
      const data: Record<string, unknown> = { resume: { connect: { id: input.resumeId } } };
      for (const key of ['name', 'position', 'url', 'summary'] as const) {
        if (item[key] !== undefined) data[key] = item[key];
      }
      for (const key of ['startDate', 'endDate'] as const) {
        const v = item[key];
        if (v !== undefined && v !== '') {
          if (!isValidDateInput(v)) {
            errors.push({ path: `work[${i}].${key}`, message: `Invalid date: ${v}` });
          } else {
            data[key] = encodeDate(v);
          }
        }
      }
      if ((item.highlights ?? []).length > 0) {
        data.highlights = {
          create: item.highlights!.map((value) => ({ value })),
        };
      }
      ops.push({ kind: 'createResumeWork', data });
      continue;
    }

    const origIdx = originalIds.indexOf(id);
    const orig = origIdx >= 0 ? original[origIdx] : undefined;
    const cmsWork = cmsWorkById.get(id);

    const data: Record<string, unknown> = {};
    for (const key of ['name', 'position', 'url', 'summary'] as const) {
      if (item[key] !== orig?.[key]) data[key] = item[key];
    }
    for (const key of ['startDate', 'endDate'] as const) {
      const cv = (item as JsonResumeWork)[key];
      const ov = (orig as JsonResumeWork | undefined)?.[key];
      if (cv !== ov) {
        if (!isValidDateInput(cv)) {
          errors.push({ path: `work[${i}].${key}`, message: `Invalid date: ${cv}` });
        } else {
          data[key] = encodeDate(cv);
        }
      }
    }
    if (Object.keys(data).length > 0) {
      ops.push({ kind: 'updateResumeWork', id, data });
    }

    if (cmsWork) {
      diffHighlights({
        workId: id,
        current: item.highlights ?? [],
        original: orig?.highlights ?? [],
        cmsHighlights: cmsWork.highlights ?? [],
        ops,
      });
    }
  }

  // Deletes.
  const liveSet = new Set(liveIds.filter((x): x is string => x !== null));
  for (const id of originalIds) {
    if (id !== null && !liveSet.has(id)) {
      ops.push({ kind: 'deleteResumeWork', id });
    }
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
