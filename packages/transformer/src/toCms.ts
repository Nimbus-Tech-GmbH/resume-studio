/**
 * JSON Resume → CMS mutation plan.
 *
 * Handles full CRUD:
 *   - basics scalars                 → updateResumeBasicInformation
 *   - basics.location scalars        → updateResumeLocation
 *   - list section field edits       → updateResumeXxx / updateCertification
 *   - list section create            → createResumeXxx (or updateResume for
 *                                       certificates via nested create on
 *                                       resumeCertifications relation)
 *   - list section delete            → deleteResumeXxx (or updateResume for
 *                                       certificates via disconnect on
 *                                       resumeCertifications relation)
 *   - work highlight CRUD            → createResumeHighlight,
 *                                       updateResumeHighlight,
 *                                       deleteResumeHighlight
 *
 * Constraints (see PLAN §10.2):
 *   - No `order` field on any list. Reorder is UI-only.
 *   - `Certification` is a shared list accessed via the `ResumeCertification`
 *     join table; create/delete goes through
 *     `updateResume { resumeCertifications: { create / disconnect } }`.
 *   - Edits to existing certifications go through `updateCertification` using
 *     the `Certification.id` (looked up from `originalCms.resumeCertifications`).
 *   - `Certification` has no `date` / `issuer`, so those are dropped.
 */

import { encodeDate, isValidDateInput } from './dateCodec';
import { encodeList } from './listCodec';
import { diffScalars } from './diff';
import type {
  CmsHighlight,
  CmsResume,
  CmsResumeCertification,
  JsonResume,
  JsonResumeAward,
  JsonResumeBasics,
  JsonResumeCertificate,
  JsonResumeEducation,
  JsonResumeInterest,
  JsonResumeLanguage,
  JsonResumeProject,
  JsonResumePublication,
  JsonResumeSkill,
  JsonResumeVolunteer,
  JsonResumeWork,
} from './types';

// ─── op union ────────────────────────────────────────────────────────────

export type MutationOp =
  | { kind: 'updateResumeBasicInformation'; id: string; data: Record<string, unknown> }
  | { kind: 'updateResumeLocation'; id: string; data: Record<string, unknown> }
  | { kind: 'createResumeLocation'; data: Record<string, unknown> }
  | { kind: 'deleteResumeLocation'; id: string }
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
  | { kind: 'updateResumeAward'; id: string; data: Record<string, unknown> }
  | { kind: 'createResumeAward'; data: Record<string, unknown> }
  | { kind: 'deleteResumeAward'; id: string }
  | { kind: 'updateResumePublication'; id: string; data: Record<string, unknown> }
  | { kind: 'createResumePublication'; data: Record<string, unknown> }
  | { kind: 'deleteResumePublication'; id: string }
  | { kind: 'updateResumeLanguage'; id: string; data: Record<string, unknown> }
  | { kind: 'createResumeLanguage'; data: Record<string, unknown> }
  | { kind: 'deleteResumeLanguage'; id: string }
  | { kind: 'updateCertification'; id: string; data: Record<string, unknown> }
  | { kind: 'updateResume'; id: string; data: Record<string, unknown> }
  | { kind: 'createResumeProfile'; data: Record<string, unknown> }
  | { kind: 'updateResumeProfile'; id: string; data: Record<string, unknown> }
  | { kind: 'deleteResumeProfile'; id: string };

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
  awards: Array<string | null>;
  publications: Array<string | null>;
  certificates: Array<string | null>;
  languages: Array<string | null>;
  profiles: Array<string | null>;
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
  diffProfiles(input, ops);
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
    section: 'awards',
    encode: encodeAward,
    createKind: 'createResumeAward',
    updateKind: 'updateResumeAward',
    deleteKind: 'deleteResumeAward',
  });
  diffSection(input, ops, errors, {
    section: 'publications',
    encode: encodePublication,
    createKind: 'createResumePublication',
    updateKind: 'updateResumePublication',
    deleteKind: 'deleteResumePublication',
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
  const data = diffScalars(flattenBasics(cur), flattenBasics(orig));

  const curImageUrl = cur?.image;
  const origImageUrl = orig?.image;
  if (curImageUrl !== origImageUrl) {
    if (curImageUrl) {
      data.image = { create: { src: curImageUrl } };
    } else {
      data.image = { disconnect: true };
    }
  }

  if (Object.keys(data).length > 0) {
    ops.push({ kind: 'updateResumeBasicInformation', id: cmsBi.id, data });
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

  if (!cmsLoc) {
    // No existing location in CMS — create one if user has location data.
    if (cur && Object.keys(diffScalars(cur, {})).length > 0) {
      const data: Record<string, unknown> = { ...cur };
      if (input.resumeId) {
        data.basicInformation = { connect: { id: input.originalCms.basicInformation?.id } };
      }
      ops.push({ kind: 'createResumeLocation', data });
    }
    return;
  }

  // Location exists in CMS but user cleared it — delete it.
  if (!cur || Object.keys(cur).length === 0) {
    ops.push({ kind: 'deleteResumeLocation', id: cmsLoc.id });
    return;
  }

  const changed = diffScalars(cur, orig ?? {});
  if (Object.keys(changed).length > 0) {
    ops.push({ kind: 'updateResumeLocation', id: cmsLoc.id, data: changed });
  }
}

// ─── profiles (list under basicInformation) ──────────────────────────────

function diffProfiles(input: ToCmsInput, ops: MutationOp[]): void {
  const current = input.current.basics?.profiles ?? [];
  const original = input.original.basics?.profiles ?? [];
  const liveIds = input.cmsIds.profiles;
  const originalIds = input.originalCmsIds.profiles;
  const cmsBiId = input.originalCms.basicInformation?.id;

  for (let i = 0; i < current.length; i += 1) {
    const item = current[i]!;
    const id = liveIds[i];
    if (id === null || id === undefined) {
      const data = encodeProfile(item, undefined, true);
      if (cmsBiId) {
        data.basicInformation = { connect: { id: cmsBiId } };
      }
      ops.push({ kind: 'createResumeProfile', data });
      continue;
    }
    const origIdx = originalIds.indexOf(id);
    const orig = origIdx >= 0 ? original[origIdx] : undefined;
    const data = encodeProfile(item, orig, false);
    if (Object.keys(data).length > 0) {
      ops.push({ kind: 'updateResumeProfile', id, data });
    }
  }

  const liveSet = new Set(liveIds.filter((x): x is string => x !== null));
  for (const id of originalIds) {
    if (id !== null && !liveSet.has(id)) {
      ops.push({ kind: 'deleteResumeProfile', id });
    }
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

function encodeAward(
  c: JsonResumeAward,
  o: JsonResumeAward | undefined,
  isCreate: boolean,
  errors: ValidationError[],
  path: string,
  resumeId: string,
): Record<string, unknown> | null {
  const data: Record<string, unknown> = {};
  for (const key of ['title', 'awarder', 'summary', 'url'] as const) {
    if (isCreate || c[key] !== o?.[key]) data[key] = c[key];
  }
  if (isCreate || c.date !== o?.date) {
    if (!isValidDateInput(c.date)) {
      errors.push({ path: `${path}.date`, message: `Invalid date: ${c.date}` });
    } else {
      data.date = encodeDate(c.date);
    }
  }
  if (isCreate) data.resume = { connect: { id: resumeId } };
  return data;
}

function encodePublication(
  c: JsonResumePublication,
  o: JsonResumePublication | undefined,
  isCreate: boolean,
  errors: ValidationError[],
  path: string,
  resumeId: string,
): Record<string, unknown> | null {
  const data: Record<string, unknown> = {};
  for (const key of ['name', 'publisher', 'summary', 'url'] as const) {
    if (isCreate || c[key] !== o?.[key]) data[key] = c[key];
  }
  if (isCreate || c.releaseDate !== o?.releaseDate) {
    if (!isValidDateInput(c.releaseDate)) {
      errors.push({ path: `${path}.releaseDate`, message: `Invalid date: ${c.releaseDate}` });
    } else {
      data.releaseDate = encodeDate(c.releaseDate);
    }
  }
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

function encodeProfile(
  c: { network?: string; username?: string; url?: string },
  o: { network?: string; username?: string; url?: string } | undefined,
  isCreate: boolean,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (isCreate || c.network !== o?.network) data.network = c.network;
  if (isCreate || c.username !== o?.username) data.username = c.username;
  if (isCreate || c.url !== o?.url) data.url = c.url;
  return data;
}

// ─── certificates (shared list, handled via updateResume) ────────────────

function diffCertificates(input: ToCmsInput, ops: MutationOp[]): void {
  const current = input.current.certificates ?? [];
  const original = input.original.certificates ?? [];
  const liveIds = input.cmsIds.certificates;
  const originalIds = input.originalCmsIds.certificates;
  const originalCmsResumeCerts: CmsResumeCertification[] =
    input.originalCms.resumeCertifications ?? [];

  const createDatas: Array<Record<string, unknown>> = [];

  for (let i = 0; i < current.length; i += 1) {
    const c = current[i]!;
    const id = liveIds[i];
    if (id === null || id === undefined) {
      // New certificate: nested create via updateResume
      createDatas.push({
        credentialUrl: undefined,
        certification: { create: encodeCertificate(c) },
      });
      continue;
    }
    // Existing row: find the matching original by ResumeCertification.id
    const origIdx = originalIds.indexOf(id);
    const o = origIdx >= 0 ? original[origIdx] : undefined;
    const data = encodeCertificate(c, o);
    if (Object.keys(data).length > 0) {
      // Look up Certification.id from the original CMS data
      const certId = originalCmsResumeCerts[origIdx]?.certification?.id;
      if (certId) {
        ops.push({ kind: 'updateCertification', id: certId, data });
      }
    }
  }

  // Deletes: disconnect ResumeCertification rows
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
      data: { resumeCertifications: nested },
    });
  }
}

function encodeCertificate(
  c: JsonResumeCertificate,
  o?: JsonResumeCertificate,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (c.name !== o?.name) data.title = c.name;
  if (c.url !== o?.url) data.link = c.url;
  if (c.summary !== o?.summary) data.description = c.summary;
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

  // Build a map of CMS highlights by their value for content-based matching.
  const cmsByValue = new Map<string, { id: string }>();
  for (const row of cmsHighlights) {
    if (row.id && row.value !== undefined) {
      cmsByValue.set(row.value, { id: row.id });
    }
  }

  // Build a set of original values to detect which CMS rows are still relevant.
  const originalValues = new Set(original);

  const usedCmsIds = new Set<string>();

  for (const value of current) {
    const existing = cmsByValue.get(value);
    if (existing) {
      // This value already exists in CMS — reuse its row (no update needed).
      usedCmsIds.add(existing.id);
    } else {
      // New value not in CMS — find a CMS row whose value was in the original
      // snapshot but no longer matches any current value (user changed it).
      const orphanedRow = cmsHighlights.find(
        (r) => r.id && !usedCmsIds.has(r.id) && originalValues.has(r.value ?? ''),
      );
      if (orphanedRow?.id) {
        // Reuse this CMS row — its old value was changed by the user.
        usedCmsIds.add(orphanedRow.id);
        ops.push({ kind: 'updateResumeHighlight', id: orphanedRow.id, data: { value } });
      } else {
        // Truly new highlight — create it.
        ops.push({
          kind: 'createResumeHighlight',
          data: { value, work: { connect: { id: workId } } },
        });
      }
    }
  }

  // Delete CMS highlights that are no longer present in current.
  for (const row of cmsHighlights) {
    if (row.id && !usedCmsIds.has(row.id)) {
      ops.push({ kind: 'deleteResumeHighlight', id: row.id });
    }
  }
}
