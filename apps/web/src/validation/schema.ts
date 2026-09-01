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
 *                       skill.name, project.name/description,
 *                       volunteer.organization/position (isRequired in CMS)
 *
 * Runs on every store mutation; results feed a top-of-editor banner and gate Save.
 */

import Ajv, { type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { FLUENCY_LEVELS, SKILL_LEVELS } from '@resume-studio/transformer';
import type { JsonResume } from '@resume-studio/transformer';

// Mirrors ResumeBasicInformation.phone validation in schema.ts.
const PHONE_REGEX = /^(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;
// Mirrors ResumeBasicInformation.email validation in schema.ts.
const EMAIL_REGEX = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;

const DATE_PATTERN = '^\\d{4}-\\d{2}(-\\d{2})?$';

const schema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    basics: {
      type: 'object',
      additionalProperties: true,
      properties: {
        // CMS: isRequired + email regex.
        email: {
          type: 'string',
          pattern: EMAIL_REGEX.source,
          nullable: true,
        },
        // CMS: optional, but must match the phone regex when present.
        phone: {
          type: 'string',
          pattern: PHONE_REGEX.source,
          minLength: 1,
        },
        url: { type: 'string', format: 'uri', nullable: true },
      },
    },
    work: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        // CMS: name/position/startDate are isRequired.
        required: ['name', 'position', 'startDate'],
        properties: {
          url: { type: 'string', format: 'uri', nullable: true },
          startDate: { type: 'string', pattern: DATE_PATTERN, nullable: true },
          endDate: { type: 'string', pattern: DATE_PATTERN, nullable: true },
        },
      },
    },
    education: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        // CMS: institution isRequired.
        required: ['institution'],
        properties: {
          url: { type: 'string', format: 'uri', nullable: true },
          startDate: { type: 'string', pattern: DATE_PATTERN, nullable: true },
          endDate: { type: 'string', pattern: DATE_PATTERN, nullable: true },
        },
      },
    },
    skills: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        // CMS: name isRequired; level is a select.
        required: ['name'],
        properties: {
          level: { type: 'string', enum: [...SKILL_LEVELS], nullable: true },
        },
      },
    },
    languages: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        // CMS: language isRequired; fluency is a select.
        required: ['language'],
        properties: {
          fluency: { type: 'string', enum: [...FLUENCY_LEVELS], nullable: true },
        },
      },
    },
    volunteer: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        // CMS: organization/position are isRequired.
        required: ['organization', 'position'],
        properties: {
          url: { type: 'string', format: 'uri', nullable: true },
          startDate: { type: 'string', pattern: DATE_PATTERN, nullable: true },
          endDate: { type: 'string', pattern: DATE_PATTERN, nullable: true },
        },
      },
    },
    projects: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        // CMS: name/description are isRequired.
        required: ['name', 'description'],
        properties: {
          url: { type: 'string', format: 'uri', nullable: true },
          startDate: { type: 'string', pattern: DATE_PATTERN, nullable: true },
          endDate: { type: 'string', pattern: DATE_PATTERN, nullable: true },
        },
      },
    },
  },
} as const;

const ajv = new Ajv({ allErrors: true, strict: false, coerceTypes: false });
addFormats(ajv);
const validateFn = ajv.compile(schema);

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
  const ok = validateFn(cleaned);
  if (ok) return [];
  const errors: ErrorObject[] = validateFn.errors ?? [];
  return errors.map((e) => ({
    path: e.instancePath || '/',
    message: e.message ?? 'invalid',
    severity: severityFor(e.instancePath || '/'),
  }));
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
