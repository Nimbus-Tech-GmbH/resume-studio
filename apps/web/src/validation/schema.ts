/**
 * Editor validation mirroring the Keystone list validations in `schema.ts`
 * (`nt-keystone-cms`). We do not import the full official JSON Resume schema
 * (heavy + noisy for a WYSIWYG flow). Instead we validate what the CMS will
 * actually enforce or reject:
 *
 *   - `basics.email`  — required + regex match (ResumeBasicInformation.email)
 *   - `basics.phone`  — optional but must match the CMS regex when present
 *   - enum fields     — skill.level / language.fluency must be one of the
 *                       CMS `select` options (or empty)
 *   - date fields     — blank or YYYY-MM(-DD) (CMS stores DateTime)
 *   - URL fields      — valid URL or empty
 *   - required text   — work.name/position/startDate, education.institution,
 *                       skill.name, language.language, project.name/description,
 *                       volunteer.organization/position,
 *                       award.title/awarder, publication.name/publisher
 *                       (isRequired in CMS)
 *
 * Runs on every store mutation; results feed a top-of-editor banner and gate Save.
 */

import { z } from 'zod';
import { FLUENCY_LEVELS, SKILL_LEVELS } from '@resume-studio/transformer';
import type { JsonResume } from '@resume-studio/transformer';

// Mirrors ResumeBasicInformation.phone validation in schema.ts.
const PHONE_REGEX = /^(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;
// Mirrors ResumeBasicInformation.email validation in schema.ts.
const EMAIL_REGEX = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;

const DATE_PATTERN = /^\d{4}-\d{2}(-\d{2})?$/;

// ─── Shared sub-schemas ──────────────────────────────────────────────────

/** Valid URL or omitted (empty strings are stripped by deepClean). */
const urlField = z.string().url('must be a valid URL').optional();

/** YYYY-MM(-DD) date or omitted. */
const dateField = z
  .string()
  .regex(DATE_PATTERN, 'must be YYYY-MM or YYYY-MM-DD')
  .optional();

// ─── Item schemas ────────────────────────────────────────────────────────

const workItemSchema = z
  .object({
    name: z.string().min(1, 'is required'),
    position: z.string().min(1, 'is required'),
    startDate: z.string().regex(DATE_PATTERN, 'must be YYYY-MM or YYYY-MM-DD'),
    url: urlField,
    endDate: dateField,
  })
  .passthrough();

const educationItemSchema = z
  .object({
    institution: z.string().min(1, 'is required'),
    url: urlField,
    startDate: dateField,
    endDate: dateField,
  })
  .passthrough();

const skillItemSchema = z
  .object({
    name: z.string().min(1, 'is required'),
    level: z.enum(SKILL_LEVELS).optional(),
  })
  .passthrough();

const languageItemSchema = z
  .object({
    language: z.string().min(1, 'is required'),
    fluency: z.enum(FLUENCY_LEVELS).optional(),
  })
  .passthrough();

const volunteerItemSchema = z
  .object({
    organization: z.string().min(1, 'is required'),
    position: z.string().min(1, 'is required'),
    url: urlField,
    startDate: dateField,
    endDate: dateField,
  })
  .passthrough();

const projectItemSchema = z
  .object({
    name: z.string().min(1, 'is required'),
    description: z.string().min(1, 'is required'),
    url: urlField,
    startDate: dateField,
    endDate: dateField,
  })
  .passthrough();

const awardItemSchema = z
  .object({
    title: z.string().min(1, 'is required'),
    awarder: z.string().min(1, 'is required'),
    date: dateField,
    url: urlField,
  })
  .passthrough();

const publicationItemSchema = z
  .object({
    name: z.string().min(1, 'is required'),
    publisher: z.string().min(1, 'is required'),
    releaseDate: dateField,
    url: urlField,
  })
  .passthrough();

// ─── Resume schema ───────────────────────────────────────────────────────

const resumeSchema = z
  .object({
    basics: z
      .object({
        email: z.string().regex(EMAIL_REGEX, 'must be a valid email address'),
        phone: z
          .string()
          .regex(PHONE_REGEX, 'must match phone format')
          .optional(),
        url: urlField,
      })
      .passthrough()
      .optional(),
    work: z.array(workItemSchema).optional(),
    education: z.array(educationItemSchema).optional(),
    skills: z.array(skillItemSchema).optional(),
    languages: z.array(languageItemSchema).optional(),
    volunteer: z.array(volunteerItemSchema).optional(),
    projects: z.array(projectItemSchema).optional(),
    awards: z.array(awardItemSchema).optional(),
    publications: z.array(publicationItemSchema).optional(),
  })
  .passthrough();

// ─── Validation issue type ───────────────────────────────────────────────

export interface ValidationIssue {
  path: string;
  message: string;
  /**
   * `error` blocks Save; `warning` is display-only.
   * Enum mismatches are warnings because legacy CMS rows may hold values
   * predating the Keystone `select` constraint — they must stay editable.
   */
  severity: 'error' | 'warning';
}

/** Paths validated as warnings instead of errors (legacy-data tolerance). */
function severityFor(path: string): 'error' | 'warning' {
  // Legacy CMS rows may hold fluency/level values predating the Keystone
  // `select` constraint — flag them but don't block editing/saving.
  if (/^\/languages\/\d+\/fluency$/.test(path)) return 'warning';
  if (/^\/skills\/\d+\/level$/.test(path)) return 'warning';
  return 'error';
}

export function validateResume(resume: JsonResume): ValidationIssue[] {
  const cleaned = deepClean(resume);
  const result = resumeSchema.safeParse(cleaned);
  if (result.success) return [];
  return result.error.issues.map((issue) => {
    const path = '/' + issue.path.map(String).join('/');
    return {
      path: path || '/',
      message: issue.message,
      severity: severityFor(path || '/'),
    };
  });
}

function deepClean<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(deepClean) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === '' || v === undefined) continue;
      out[k] = deepClean(v);
    }
    return out as T;
  }
  return value;
}
