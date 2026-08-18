/**
 * JSON Resume schema validation — small subset tailored to editing.
 *
 * We do not import the full official schema (heavy + noisy for a WYSIWYG
 * flow). Instead we validate the high-value fields the editor touches:
 *   - `basics.email` must be a valid email or empty.
 *   - `basics.url` / *.url must be a valid URL or empty.
 *   - date fields must be blank or YYYY-MM(-DD).
 *
 * Runs on every store mutation; results feed a top-of-editor banner.
 */

import Ajv, { type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import type { JsonResume } from '@resume-studio/transformer';

const schema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    basics: {
      type: 'object',
      additionalProperties: true,
      properties: {
        email: { type: 'string', format: 'email', nullable: true },
        url: { type: 'string', format: 'uri', nullable: true },
      },
    },
    work: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          url: { type: 'string', format: 'uri', nullable: true },
          startDate: { type: 'string', pattern: '^\\d{4}-\\d{2}(-\\d{2})?$', nullable: true },
          endDate: { type: 'string', pattern: '^\\d{4}-\\d{2}(-\\d{2})?$', nullable: true },
        },
      },
    },
    education: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          startDate: { type: 'string', pattern: '^\\d{4}-\\d{2}(-\\d{2})?$', nullable: true },
          endDate: { type: 'string', pattern: '^\\d{4}-\\d{2}(-\\d{2})?$', nullable: true },
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
}

export function validateResume(resume: JsonResume): ValidationIssue[] {
  const cleaned = deepClean(resume);
  const ok = validateFn(cleaned);
  if (ok) return [];
  const errors: ErrorObject[] = validateFn.errors ?? [];
  return errors.map((e) => ({
    path: e.instancePath || '/',
    message: e.message ?? 'invalid',
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
