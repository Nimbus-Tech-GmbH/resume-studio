import type {
  ChangeOperation,
  TailoredResumeResponse,
  TailoringChange,
  TailoringGap,
} from './tailoring';
import {
  deepClone,
  deletePointer,
  isRecord,
  parsePointer,
  resolvePointer,
  setPointer,
} from './resumePayload';

export class TailoringValidationError extends Error {
  readonly code = 'INVALID_OUTPUT' as const;

  constructor(message: string) {
    super(message);
    this.name = 'TailoringValidationError';
  }
}

const ROOT_KEYS = ['resume', 'changes', 'gaps'] as const;
const CHANGE_KEYS = [
  'id',
  'group',
  'path',
  'op',
  'before',
  'after',
  'reason',
  'evidence',
] as const;
const GAP_KEYS = ['kind', 'requirement', 'detail', 'searched'] as const;
const CHANGE_OPS: readonly ChangeOperation[] = ['rewrite', 'reorder', 'delete', 'narrow'];
const GAP_KINDS = ['missing_requirement', 'ignored_constraint'] as const;

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

function exactKeys(row: Record<string, unknown>, expected: readonly string[], label: string): void {
  const keys = Object.keys(row);
  const missing = expected.filter((key) => !Object.prototype.hasOwnProperty.call(row, key));
  const extra = keys.filter((key) => !expected.includes(key));
  if (missing.length > 0 || extra.length > 0) {
    fail(
      `${label} must contain exactly ${expected.join(', ')} (missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'}).`,
    );
  }
}

export function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => deepEqual(value, right[index]));
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
    if (!deepEqual(left[key], right[key])) return false;
  }
  return true;
}

function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function parseChanges(input: unknown): TailoringChange[] {
  if (!Array.isArray(input)) fail('changes must be an array.');
  const ids = new Set<string>();
  return input.map((item, index) => {
    if (!isRecord(item)) fail(`changes[${index}] must be an object.`);
    exactKeys(item, CHANGE_KEYS, `changes[${index}]`);
    const id = typeof item.id === 'string' ? item.id : fail(`changes[${index}].id must be a string.`);
    if (!id) fail(`changes[${index}].id must not be empty.`);
    if (ids.has(id)) fail(`Duplicate change id: ${id}.`);
    ids.add(id);
    const group =
      typeof item.group === 'string' ? item.group : fail(`changes[${index}].group must be a string.`);
    if (!group) fail(`changes[${index}].group must not be empty.`);
    const path =
      typeof item.path === 'string' ? item.path : fail(`changes[${index}].path must be a string.`);
    if (!path.startsWith('/')) fail(`changes[${index}].path must be a JSON Pointer.`);
    if (!CHANGE_OPS.includes(item.op as ChangeOperation)) {
      fail(`changes[${index}].op is invalid.`);
    }
    const reason =
      typeof item.reason === 'string' ? item.reason : fail(`changes[${index}].reason must be a string.`);
    if (!reason.trim()) fail(`changes[${index}].reason must not be empty.`);
    if (!Array.isArray(item.evidence) || !item.evidence.every((row) => typeof row === 'string')) {
      fail(`changes[${index}].evidence must be an array of JSON Pointers.`);
    }
    for (const pointer of item.evidence) {
      if (!pointer.startsWith('/')) fail(`changes[${index}].evidence must contain JSON Pointers.`);
    }
    return {
      id,
      group,
      path,
      op: item.op as ChangeOperation,
      before: item.before,
      after: item.after,
      reason,
      evidence: item.evidence as string[],
    };
  });
}

function parseGaps(input: unknown): TailoringGap[] {
  if (!Array.isArray(input)) fail('gaps must be an array.');
  return input.map((item, index) => {
    if (!isRecord(item)) fail(`gaps[${index}] must be an object.`);
    exactKeys(item, GAP_KEYS, `gaps[${index}]`);
    if (!GAP_KINDS.includes(item.kind as TailoringGap['kind'])) {
      fail(`gaps[${index}].kind is invalid.`);
    }
    const requirement =
      typeof item.requirement === 'string'
        ? item.requirement
        : fail(`gaps[${index}].requirement must be a string.`);
    if (!requirement.trim()) fail(`gaps[${index}].requirement must not be empty.`);
    const detail =
      typeof item.detail === 'string' ? item.detail : fail(`gaps[${index}].detail must be a string.`);
    if (
      !Array.isArray(item.searched) ||
      !item.searched.every((row) => typeof row === 'string' && row.startsWith('/'))
    ) {
      fail(`gaps[${index}].searched must be an array of JSON Pointers.`);
    }
    return {
      kind: item.kind as TailoringGap['kind'],
      requirement,
      detail,
      searched: item.searched as string[],
    };
  });
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

function validateHighlights(
  source: unknown,
  next: unknown,
  path: string,
  hasDeleteChange: boolean,
): void {
  if (!Array.isArray(source) || !Array.isArray(next)) fail(`${path} must be an array.`);
  if (!next.every((row) => typeof row === 'string')) {
    fail(`${path} must contain strings.`);
  }
  if (next.length > source.length) fail(`${path} must not add highlights.`);

  const deletion = next.length < source.length || hasDeleteChange;
  if (!deletion) return;

  const remaining = [...next];
  for (const row of source) {
    if (typeof row !== 'string') continue;
    const exact = remaining.indexOf(row);
    if (exact >= 0) {
      remaining.splice(exact, 1);
      continue;
    }
    if (!next.some((kept) => typeof kept === 'string' && covers(row, kept))) {
      fail(`${path} deletes a highlight that no kept highlight covers: “${row}”.`);
    }
  }
}

function validateBasics(source: Record<string, unknown>, next: Record<string, unknown>): void {
  const sourceKeys = Object.keys(source);
  const mayAddSummary = !Object.prototype.hasOwnProperty.call(source, 'summary');
  const allowedKeys = mayAddSummary ? [...sourceKeys, 'summary'] : sourceKeys;
  const missing = sourceKeys.filter((key) => !Object.prototype.hasOwnProperty.call(next, key));
  const extra = Object.keys(next).filter((key) => !allowedKeys.includes(key));
  if (missing.length > 0 || extra.length > 0) {
    fail(
      `/basics must contain exactly ${allowedKeys.join(', ')} (missing: ${
        missing.join(', ') || 'none'
      }; extra: ${extra.join(', ') || 'none'}).`,
    );
  }

  for (const key of sourceKeys) {
    const path = `/basics/${key}`;
    if (key === 'summary') {
      if (typeof next[key] !== 'string' || typeof source[key] !== 'string') {
        fail(`${path} must stay a string.`);
      }
      continue;
    }
    if (key === 'label') {
      if (typeof next[key] !== 'string' || typeof source[key] !== 'string') {
        fail(`${path} must stay a string.`);
      }
      if (typeof source[key] === 'string' && source[key].trim() && !next[key].trim()) {
        fail(`${path} must not be emptied.`);
      }
      if (!labelsNarrowOnly(source[key], next[key])) {
        fail(`${path} adds a meaningful word that was not in the editor label.`);
      }
      continue;
    }
    if (!deepEqual(source[key], next[key])) fail(`${path} must not change.`);
  }

  if (mayAddSummary && typeof next.summary !== 'string') {
    fail('/basics/summary must be a string.');
  }
}

function validateItems(
  source: unknown,
  next: unknown,
  section: 'work' | 'projects',
): void {
  if (!Array.isArray(source) || !Array.isArray(next)) fail(`/${section} must be an array.`);
  if (source.length !== next.length) {
    fail(`/${section} must not add, remove, or reorder entries.`);
  }
  for (let index = 0; index < source.length; index += 1) {
    const sourceItem = source[index];
    const nextItem = next[index];
    if (!isRecord(sourceItem) || !isRecord(nextItem)) {
      fail(`/${section}/${index} must be an object.`);
    }
    exactKeys(nextItem, Object.keys(sourceItem), `/${section}/${index}`);
    for (const key of Object.keys(sourceItem)) {
      const path = `/${section}/${index}/${key}`;
      if (section === 'work' && key === 'summary') {
        if (typeof sourceItem[key] !== 'string' || typeof nextItem[key] !== 'string') {
          fail(`${path} must stay a string.`);
        }
        continue;
      }
      if (section === 'projects' && key === 'description') {
        if (typeof sourceItem[key] !== 'string' || typeof nextItem[key] !== 'string') {
          fail(`${path} must stay a string.`);
        }
        continue;
      }
      if (key === 'highlights') {
        validateHighlights(sourceItem[key], nextItem[key], path, false);
        continue;
      }
      if (!deepEqual(sourceItem[key], nextItem[key])) fail(`${path} must not change.`);
    }
  }
}

function skillSignature(skill: unknown): string {
  if (!isRecord(skill)) return canonicalStringify(skill);
  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(skill)) {
    const value = skill[key];
    copy[key] =
      key === 'keywords' && Array.isArray(value) ? [...value].map(String).sort() : value;
  }
  return canonicalStringify(copy);
}

function validateSkills(source: unknown, next: unknown): void {
  if (!Array.isArray(source) || !Array.isArray(next)) fail('/skills must be an array.');
  if (source.length !== next.length) {
    fail('/skills must not add or remove entries.');
  }
  const sourceSignatures = source.map(skillSignature).sort();
  const nextSignatures = next.map(skillSignature).sort();
  if (!deepEqual(sourceSignatures, nextSignatures)) {
    fail('/skills may only change order; names, keywords, and levels must stay identical.');
  }
}

function validateResumeAgainstSource(
  source: Record<string, unknown>,
  next: Record<string, unknown>,
): void {
  exactKeys(next, Object.keys(source), 'resume');
  for (const key of Object.keys(source)) {
    const path = `/${key}`;
    if (key === 'basics') {
      if (!isRecord(next[key]) || !isRecord(source[key])) fail('/basics must be an object.');
      validateBasics(source[key], next[key]);
      continue;
    }
    if (key === 'work' || key === 'projects') {
      validateItems(source[key], next[key], key);
      continue;
    }
    if (key === 'skills') {
      validateSkills(source[key], next[key]);
      continue;
    }
    if (!deepEqual(source[key], next[key])) fail(`${path} must not change.`);
  }
}

const ALLOWED_CHANGE_PATTERNS: Array<{ op: ChangeOperation; pattern: RegExp }> = [
  { op: 'rewrite', pattern: /^\/basics\/summary$/ },
  { op: 'narrow', pattern: /^\/basics\/label$/ },
  { op: 'rewrite', pattern: /^\/work\/\d+\/summary$/ },
  { op: 'rewrite', pattern: /^\/work\/\d+\/highlights\/\d+$/ },
  { op: 'delete', pattern: /^\/work\/\d+\/highlights\/\d+$/ },
  { op: 'reorder', pattern: /^\/work\/\d+\/highlights$/ },
  { op: 'rewrite', pattern: /^\/projects\/\d+\/description$/ },
  { op: 'rewrite', pattern: /^\/projects\/\d+\/highlights\/\d+$/ },
  { op: 'delete', pattern: /^\/projects\/\d+\/highlights\/\d+$/ },
  { op: 'reorder', pattern: /^\/projects\/\d+\/highlights$/ },
  { op: 'reorder', pattern: /^\/skills$/ },
  { op: 'reorder', pattern: /^\/skills\/\d+\/keywords$/ },
];

function assertChangePathAllowed(change: TailoringChange): void {
  const allowed = ALLOWED_CHANGE_PATTERNS.some(
    (row) => row.op === change.op && row.pattern.test(change.path),
  );
  if (!allowed) fail(`Change ${change.id} targets a path that may not change: ${change.path}.`);
}

function sortedMultiset(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) fail(`${path} must be an array.`);
  return value.map(canonicalStringify).sort();
}

function assertReorderIsPermutation(
  change: TailoringChange,
  source: Record<string, unknown>,
  next: Record<string, unknown>,
): void {
  const before = resolvePointer(source, change.path).value;
  const after = resolvePointer(next, change.path).value;
  const beforeRows = sortedMultiset(before, `${change.path} before-value`);
  const afterRows = sortedMultiset(after, `${change.path} after-value`);
  if (!deepEqual(beforeRows, afterRows)) {
    fail(`Change ${change.id} reorders ${change.path} but changes its contents.`);
  }
}

function pointerRows(change: TailoringChange, source: Record<string, unknown>, next: Record<string, unknown>): void {
  const before = resolvePointer(source, change.path);
  const expectedBefore = before.found ? before.value : null;

  if (!deepEqual(change.before, expectedBefore)) {
    fail(`Change ${change.id} before-value does not match the editor resume.`);
  }

  if (change.op === 'delete') {
    if (change.after !== null) fail(`Change ${change.id} delete must have a null after-value.`);
    return;
  }

  const after = resolvePointer(next, change.path);
  const expectedAfter = after.found ? after.value : null;
  if (!deepEqual(change.after, expectedAfter)) {
    fail(`Change ${change.id} after-value does not match the returned resume.`);
  }
}

function validateChangeSet(
  changes: readonly TailoringChange[],
  source: Record<string, unknown>,
  next: Record<string, unknown>,
): void {
  const reorders = changes.filter((change) => change.op === 'reorder');
  for (const reorder of reorders) {
    const nested = changes.some(
      (change) => change !== reorder && change.path.startsWith(`${reorder.path}/`),
    );
    if (nested) {
      fail(`Change set mixes reorder and nested edits at ${reorder.path}.`);
    }
  }

  for (const change of changes) {
    assertChangePathAllowed(change);
    pointerRows(change, source, next);
    if (change.op === 'reorder') {
      assertReorderIsPermutation(change, source, next);
    }
    for (const evidence of change.evidence) {
      if (!resolvePointer(source, evidence).found) {
        fail(`Change ${change.id} cites missing evidence ${evidence}.`);
      }
    }
  }
}

function validateGapsAgainstSource(
  gaps: readonly TailoringGap[],
  source: Record<string, unknown>,
): void {
  gaps.forEach((gap, index) => {
    for (const pointer of gap.searched) {
      if (!resolvePointer(source, pointer).found) {
        fail(`gaps[${index}] cites a missing searched path ${pointer}.`);
      }
    }
  });
}

function allStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const row of value) allStrings(row, out);
    return;
  }
  if (isRecord(value)) {
    for (const key of Object.keys(value)) allStrings(value[key], out);
  }
}

function tokenize(text: string): string[] {
  return text.match(/[A-Za-z0-9][A-Za-z0-9.+#%-]*/g) ?? [];
}

/** Strip sentence punctuation while keeping meaningful tool punctuation like node.js or C++. */
function normalizeFactToken(token: string): string {
  let next = token.toLowerCase();
  if (next.endsWith('.') && !next.slice(0, -1).includes('.')) next = next.slice(0, -1);
  next = next.replace(/[-]+$/, '');
  return next;
}

function numericToken(token: string): string | null {
  if (!/\d/.test(token)) return null;
  return normalizeFactToken(token).replace(/[%,]/g, '');
}

function validateProseFacts(
  source: Record<string, unknown>,
  next: Record<string, unknown>,
): void {
  const corpusParts: string[] = [];
  allStrings(source, corpusParts);
  const sourceNumbers = new Set(
    tokenize(corpusParts.join(' '))
      .map(numericToken)
      .filter((number): number is string => number !== null),
  );

  const prose: Array<{ path: string; text: string }> = [];
  const basics = isRecord(next.basics) ? next.basics : null;
  if (basics) {
    if (typeof basics.summary === 'string') prose.push({ path: '/basics/summary', text: basics.summary });
    if (typeof basics.label === 'string') prose.push({ path: '/basics/label', text: basics.label });
  }
  for (const section of ['work', 'projects'] as const) {
    const rows = next[section];
    if (!Array.isArray(rows)) continue;
    rows.forEach((row, index) => {
      if (!isRecord(row)) return;
      const textKey = section === 'work' ? 'summary' : 'description';
      if (typeof row[textKey] === 'string') {
        prose.push({ path: `/${section}/${index}/${textKey}`, text: row[textKey] as string });
      }
      const highlights = row.highlights;
      if (Array.isArray(highlights)) {
        highlights.forEach((text, highlightIndex) => {
          if (typeof text === 'string') {
            prose.push({
              path: `/${section}/${index}/highlights/${highlightIndex}`,
              text,
            });
          }
        });
      }
    });
  }

  for (const entry of prose) {
    for (const token of tokenize(entry.text)) {
      const number = numericToken(token);
      if (number && !sourceNumbers.has(number)) {
        fail(`${entry.path} introduces an unsupported number: ${token}.`);
      }
    }
  }
}

function validateHighlightsDeletions(
  source: Record<string, unknown>,
  next: Record<string, unknown>,
  changes: readonly TailoringChange[],
): void {
  const deletedPaths = new Set(
    changes.filter((change) => change.op === 'delete').map((change) => change.path),
  );
  for (const section of ['work', 'projects'] as const) {
    const sourceRows = source[section];
    const nextRows = next[section];
    if (!Array.isArray(sourceRows) || !Array.isArray(nextRows)) continue;
    sourceRows.forEach((sourceRow, index) => {
      const nextRow = nextRows[index];
      if (!isRecord(sourceRow) || !isRecord(nextRow)) return;
      if (!Array.isArray(sourceRow.highlights) || !Array.isArray(nextRow.highlights)) return;
      const path = `/${section}/${index}/highlights`;
      const hasDelete = [...deletedPaths].some((row) => row.startsWith(`${path}/`));
      validateHighlights(sourceRow.highlights, nextRow.highlights, path, hasDelete);
    });
  }
}

export function applyTailoringChanges(
  source: Record<string, unknown>,
  response: TailoredResumeResponse,
  groupIds?: readonly string[],
): Record<string, unknown> {
  const selected = groupIds
    ? response.changes.filter((change) => groupIds.includes(change.group))
    : [...response.changes];

  const reorders = selected.filter((change) => change.op === 'reorder');
  for (const reorder of reorders) {
    const nested = selected.some(
      (change) => change !== reorder && change.path.startsWith(`${reorder.path}/`),
    );
    if (nested) throw new TailoringValidationError(`Group selection conflicts at ${reorder.path}.`);
  }

  const writes = selected.filter((change) => change.op !== 'delete');
  const deletes = selected.filter((change) => change.op === 'delete');
  const deletePaths = new Set(deletes.map((change) => change.path));
  if (writes.some((change) => deletePaths.has(change.path))) {
    throw new TailoringValidationError('A change cannot be both rewritten and deleted.');
  }

  const next = deepClone(source);

  for (const change of writes) {
    if (change.after === null) {
      deletePointer(next, change.path);
    } else {
      setPointer(next, change.path, deepClone(change.after));
    }
  }

  deletes.sort((left, right) => {
    const leftTokens = parsePointer(left.path);
    const rightTokens = parsePointer(right.path);
    const leftIndex = Number(leftTokens[leftTokens.length - 1]);
    const rightIndex = Number(rightTokens[rightTokens.length - 1]);
    return rightIndex - leftIndex;
  });
  for (const change of deletes) deletePointer(next, change.path);

  return next;
}

export function validateTailoredResponse(
  input: unknown,
  sourceResume: Record<string, unknown>,
): TailoredResumeResponse {
  if (!isRecord(input)) fail('Model output must be one JSON object.');
  exactKeys(input, ROOT_KEYS, 'response');
  if (!isRecord(input.resume)) fail('resume must be an object.');
  const changes = parseChanges(input.changes);
  const gaps = parseGaps(input.gaps);

  validateResumeAgainstSource(sourceResume, input.resume);
  validateChangeSet(changes, sourceResume, input.resume);
  validateGapsAgainstSource(gaps, sourceResume);
  validateHighlightsDeletions(sourceResume, input.resume, changes);
  validateProseFacts(sourceResume, input.resume);

  const response: TailoredResumeResponse = {
    resume: input.resume,
    changes,
    gaps,
  };

  const applied = applyTailoringChanges(sourceResume, response);
  if (!deepEqual(applied, response.resume)) {
    fail('changes do not fully describe the returned resume.');
  }

  return response;
}
