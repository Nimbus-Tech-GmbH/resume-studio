/// <reference path="./jsonresume-schema.d.ts" />
import { validate as validateJsonResumeSchema } from '@jsonresume/schema';
import { applyChangeList } from './apply';
import { AiError } from './errors';
import { canonicalStringify, deepEqual, isRecord, resolvePointer } from './pointers';
import {
  TailoringResponseSchema,
  type ParsedTailoringResponse,
} from './schemas';
import type { TailoringChange, TailoredResumeResponse } from './types';

export class TailoringValidationError extends AiError {
  constructor(message: string) {
    super('INVALID_OUTPUT', message, false);
    this.name = 'TailoringValidationError';
  }
}

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'by',
  'for',
  'from',
  'in',
  'into',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
  'via',
  'using',
]);

function fail(message: string): never {
  throw new TailoringValidationError(message);
}

/**
 * Word breaks are presentation, not meaning: "Full-Stack" and "Full Stack"
 * describe the same label. Split on every separator except tool-significant
 * punctuation such as "+" (C++) and "#" (C#).
 */
function meaningfulWords(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z0-9+#]+/g) ?? [];
  return words.filter((word) => !STOP_WORDS.has(word));
}

/** Allow a word that is just adjacent source words joined differently. */
function recombinesSourceWords(words: readonly string[], sourceWords: ReadonlySet<string>): boolean {
  if (words.length === 0) return true;
  const target = words.join('');
  const sourceList = [...sourceWords].filter((word) => word.length > 0);
  if (sourceList.length === 0) return false;
  const memo = new Map<number, boolean>();
  const canConsume = (offset: number): boolean => {
    if (offset === target.length) return true;
    const cached = memo.get(offset);
    if (cached !== undefined) return cached;
    const result = sourceList.some(
      (word) => target.startsWith(word, offset) && canConsume(offset + word.length),
    );
    memo.set(offset, result);
    return result;
  };
  return canConsume(0);
}

function labelsNarrowOnly(sourceLabel: unknown, nextLabel: unknown): boolean {
  if (typeof sourceLabel !== 'string' || typeof nextLabel !== 'string') return false;
  const sourceWords = new Set(meaningfulWords(sourceLabel));
  const nextWords = meaningfulWords(nextLabel);
  if (nextWords.every((word) => sourceWords.has(word))) return true;
  return recombinesSourceWords(nextWords, sourceWords);
}

function covers(deleted: string, kept: string): boolean {
  const keptWords = new Set(meaningfulWords(kept));
  return meaningfulWords(deleted).every((word) => keptWords.has(word));
}

function numberTokens(text: string): string[] {
  return text.match(/\d+(?:[.,]\d+)?/g) ?? [];
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string') fail(`${label} must be a string.`);
  return value;
}

function multiset(values: readonly unknown[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = canonicalStringify(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function sameMultiset(left: readonly unknown[], right: readonly unknown[]): boolean {
  if (left.length !== right.length) return false;
  const leftCounts = multiset(left);
  const rightCounts = multiset(right);
  if (leftCounts.size !== rightCounts.size) return false;
  for (const [key, count] of leftCounts) {
    if (rightCounts.get(key) !== count) return false;
  }
  return true;
}

function assertTypeShape(change: TailoringChange): void {
  const rules: Record<
    TailoringChange['type'],
    { path: RegExp; op: TailoringChange['op']; section: string }
  > = {
    'rewrite-summary': { path: /^\/basics\/summary$/, op: 'rewrite', section: 'basics' },
    'narrow-label': { path: /^\/basics\/label$/, op: 'narrow', section: 'basics' },
    'rewrite-work-summary': { path: /^\/work\/\d+\/summary$/, op: 'rewrite', section: 'work' },
    'rewrite-work-description': {
      path: /^\/work\/\d+\/description$/,
      op: 'rewrite',
      section: 'work',
    },
    'rewrite-work-highlight': {
      path: /^\/work\/\d+\/highlights\/\d+$/,
      op: 'rewrite',
      section: 'work',
    },
    'delete-work-highlight': {
      path: /^\/work\/\d+\/highlights\/\d+$/,
      op: 'delete',
      section: 'work',
    },
    'rewrite-project-description': {
      path: /^\/projects\/\d+\/description$/,
      op: 'rewrite',
      section: 'projects',
    },
    'rewrite-project-highlight': {
      path: /^\/projects\/\d+\/highlights\/\d+$/,
      op: 'rewrite',
      section: 'projects',
    },
    'delete-project-highlight': {
      path: /^\/projects\/\d+\/highlights\/\d+$/,
      op: 'delete',
      section: 'projects',
    },
    'reorder-skills': {
      path: /^\/skills(?:\/\d+\/keywords)?$/,
      op: 'reorder',
      section: 'skills',
    },
  };

  const rule = rules[change.type];
  if (!rule) fail(`Change ${change.id} has an unsupported type.`);
  if (!rule.path.test(change.path)) {
    fail(`Change ${change.id} (${change.type}) targets an unsupported path: ${change.path}.`);
  }
  if (change.op !== rule.op) {
    fail(`Change ${change.id} (${change.type}) must use op "${rule.op}".`);
  }
  if (change.section !== rule.section) {
    fail(`Change ${change.id} (${change.type}) must belong to section "${rule.section}".`);
  }
}

function assertNoNewNumbers(
  change: TailoringChange,
  before: string,
  after: string,
): void {
  const beforeNumbers = new Set(numberTokens(before));
  for (const number of numberTokens(after)) {
    if (!beforeNumbers.has(number)) {
      fail(
        `Change ${change.id} adds a number (${number}) that is not present in the source field.`,
      );
    }
  }
}

function assertHighlightDeletion(
  change: TailoringChange,
  parsed: ParsedTailoringResponse,
): void {
  const deleted = stringValue(change.before, `Change ${change.id}.before`);
  const parent = change.path.replace(/\/\d+$/, '');
  const row = resolvePointer(parsed.resume, parent);
  if (!row.found || !Array.isArray(row.value)) {
    fail(`Change ${change.id} deletes a highlight whose parent no longer exists.`);
  }
  const kept = row.value.filter((value): value is string => typeof value === 'string');
  if (!kept.some((highlight) => covers(deleted, highlight))) {
    fail(
      `Change ${change.id} deletes a highlight that no kept highlight covers. Redundant highlights only.`,
    );
  }
}

function assertSkillsReorder(change: TailoringChange): void {
  if (!Array.isArray(change.before) || !Array.isArray(change.after)) {
    fail(`Change ${change.id} must include array values for a reorder.`);
  }
  if (!sameMultiset(change.before, change.after)) {
    fail(`Change ${change.id} may only change order; skills cannot be added, removed, or renamed.`);
  }
}

/**
 * Strict structural and semantic validation. JSON Resume schema validation is
 * async and is exposed separately as `assertJsonResumeValid`.
 */
export function validateTailoredResponse(
  input: unknown,
  sourceResume: Record<string, unknown>,
  _options: { jobDescription?: string } = {},
): TailoredResumeResponse {
  if (
    isRecord(input) &&
    !('resume' in input) &&
    !('changes' in input) &&
    !('gaps' in input) &&
    ('basics' in input || 'work' in input || 'skills' in input)
  ) {
    fail(
      'The model returned a bare resume object. Expected one envelope object with exactly resume, changes, and gaps.',
    );
  }

  const parsed = TailoringResponseSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 6)
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    fail(`Model response does not match the strict contract. ${issues}`);
  }

  const response = parsed.data as unknown as TailoredResumeResponse;
  const ids = new Set<string>();
  const paths = new Set<string>();

  for (const change of response.changes) {
    if (ids.has(change.id)) fail(`Duplicate change id: ${change.id}.`);
    ids.add(change.id);
    if (paths.has(change.path)) {
      fail(`Change ${change.id} targets the same path as another change: ${change.path}.`);
    }
    paths.add(change.path);
    assertTypeShape(change);

    const row = resolvePointer(sourceResume, change.path);
    if (!row.found) {
      fail(`Change ${change.id} points at a missing source path: ${change.path}.`);
    }

    if (change.op === 'delete') {
      if (change.after !== null) fail(`Change ${change.id} must use null as the delete result.`);
      assertHighlightDeletion(change, response);
      continue;
    }

    if (!deepEqual(row.value, change.before)) {
      fail(`Change ${change.id} does not match the source value at ${change.path}.`);
    }

    if (change.op === 'narrow') {
      if (!labelsNarrowOnly(change.before, change.after)) {
        fail(`Change ${change.id} adds a meaningful word to the label instead of narrowing it.`);
      }
      continue;
    }

    if (change.op === 'reorder') {
      assertSkillsReorder(change);
      continue;
    }

    if (change.type === 'rewrite-summary' ||
      change.type === 'rewrite-work-summary' ||
      change.type === 'rewrite-work-description' ||
      change.type === 'rewrite-work-highlight' ||
      change.type === 'rewrite-project-description' ||
      change.type === 'rewrite-project-highlight') {
      const before = stringValue(change.before, `Change ${change.id}.before`);
      const after = stringValue(change.after, `Change ${change.id}.after`);
      assertNoNewNumbers(change, before, after);
    }
  }

  const gapIds = new Set<string>();
  for (const gap of response.gaps) {
    if (gapIds.has(gap.id)) fail(`Duplicate gap id: ${gap.id}.`);
    gapIds.add(gap.id);
  }

  const applied = applyChangeList(sourceResume, response.changes);
  if (!deepEqual(applied, response.resume)) {
    fail(
      'The resume preview does not match applying every listed change to the source resume. The change ledger is incomplete or inconsistent.',
    );
  }

  return response;
}

/** Validate the restored resume with the official JSON Resume schema. */
export function assertJsonResumeValid(resume: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      validateJsonResumeSchema(resume, (errors, valid) => {
        if (valid) {
          resolve();
          return;
        }
        const detail =
          (errors ?? [])
            .slice(0, 5)
            .map((error) => `${error.property ?? '(root)'}: ${error.message ?? 'invalid'}`)
            .join('; ') || 'unknown schema error';
        reject(
          new AiError(
            'INVALID_RESUME',
            `The tailored resume failed JSON Resume validation. ${detail}`,
            false,
          ),
        );
      });
    } catch (error) {
      reject(
        new AiError(
          'INVALID_RESUME',
          `Could not validate the tailored resume. ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
          false,
        ),
      );
    }
  });
}

export function isTailoringValidationError(error: unknown): error is TailoringValidationError {
  return error instanceof TailoringValidationError;
}

export function isRecordValue(value: unknown): value is Record<string, unknown> {
  return isRecord(value);
}
