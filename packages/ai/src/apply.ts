import {
  canonicalStringify,
  deepClone,
  deepEqual,
  deletePointer,
  parsePointer,
  resolvePointer,
  setPointer,
} from './pointers';
import type { ChangeGroup, TailoringChange, TailoredResumeResponse } from './types';

export class TailoringApplyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TailoringApplyError';
  }
}

/**
 * Group changes for review. The model supplies the group id; related edits
 * (for example a rewrite that absorbs a duplicate highlight) share one id.
 */
export function groupChanges(changes: readonly TailoringChange[]): ChangeGroup[] {
  const groups = new Map<string, TailoringChange[]>();
  for (const change of changes) {
    const rows = groups.get(change.group) ?? [];
    rows.push(change);
    groups.set(change.group, rows);
  }
  return [...groups.entries()].map(([id, rows]) => {
    const first = rows[0]!;
    return {
      id,
      label: `${first.section}: ${first.entity}`,
      section: first.section,
      changes: rows,
    };
  });
}

function parentPath(path: string): string {
  const tokens = parsePointer(path);
  const parent = tokens.slice(0, -1);
  return parent.length === 0 ? '' : `/${parent.join('/')}`;
}

function deleteSortValue(path: string): { parent: string; index: number } | null {
  const tokens = parsePointer(path);
  const index = Number(tokens[tokens.length - 1]);
  if (!Number.isInteger(index)) return null;
  return { parent: parentPath(path), index };
}

/** Apply an already-validated change list. Deletes run last, in descending order. */
export function applyChangeList(
  source: Record<string, unknown>,
  changes: readonly TailoringChange[],
): Record<string, unknown> {
  const next = deepClone(source);
  const deletes: TailoringChange[] = [];
  const writes: TailoringChange[] = [];

  for (const change of changes) {
    if (change.op === 'delete') deletes.push(change);
    else writes.push(change);
  }

  for (const change of writes) {
    setPointer(next, change.path, deepClone(change.after));
  }

  const byParent = new Map<string, TailoringChange[]>();
  for (const change of deletes) {
    const row = deleteSortValue(change.path);
    if (!row) {
      deletePointer(next, change.path);
      continue;
    }
    const rows = byParent.get(row.parent) ?? [];
    rows.push(change);
    byParent.set(row.parent, rows);
  }

  for (const rows of byParent.values()) {
    rows
      .map((change) => ({ change, row: deleteSortValue(change.path)! }))
      .sort((left, right) => right.row.index - left.row.index)
      .forEach(({ change }) => deletePointer(next, change.path));
  }

  return next;
}

export interface ApplyResult {
  resume: Record<string, unknown>;
  appliedChangeIds: string[];
  appliedGroupIds: string[];
  rejectedChangeIds: string[];
}

/**
 * Apply only accepted groups, starting from the current editor document. A
 * rejected group is a no-op; a change whose source value no longer matches is
 * a conflict instead of a silent overwrite.
 */
export function applyTailoringChanges(
  source: Record<string, unknown>,
  response: Pick<TailoredResumeResponse, 'changes'>,
  selectedGroupIds: readonly string[],
): Record<string, unknown> {
  return applyTailoringSelection(source, response.changes, selectedGroupIds).resume;
}

export function applyTailoringSelection(
  source: Record<string, unknown>,
  changes: readonly TailoringChange[],
  selectedGroupIds: readonly string[],
): ApplyResult {
  const selected = new Set(selectedGroupIds);
  const accepted = changes.filter((change) => selected.has(change.group));
  const rejected = changes.filter((change) => !selected.has(change.group));

  for (const change of accepted) {
    const row = resolvePointer(source, change.path);
    if (!row.found) {
      throw new TailoringApplyError(
        `Cannot apply change ${change.id}: source path ${change.path} no longer exists.`,
      );
    }
    if (change.op === 'delete') {
      if (!deepEqual(row.value, change.before)) {
        throw new TailoringApplyError(
          `Cannot apply change ${change.id}: source highlight changed after analysis.`,
        );
      }
      continue;
    }
    if (!deepEqual(row.value, change.before)) {
      throw new TailoringApplyError(
        `Cannot apply change ${change.id}: source value changed after analysis.`,
      );
    }
  }

  const resume = applyChangeList(source, accepted);
  return {
    resume,
    appliedChangeIds: accepted.map((change) => change.id),
    appliedGroupIds: [...new Set(accepted.map((change) => change.group))],
    rejectedChangeIds: rejected.map((change) => change.id),
  };
}

export interface ApplyTransaction {
  id: string;
  before: Record<string, unknown>;
  afterHash: string;
  appliedGroupIds: string[];
}

export interface UndoResult {
  ok: true;
  resume: Record<string, unknown>;
}

export interface UndoFailure {
  ok: false;
  reason: string;
}

export function undoApplyTransaction(
  current: Record<string, unknown>,
  transaction: ApplyTransaction,
  currentHash: (resume: Record<string, unknown>) => string,
): UndoResult | UndoFailure {
  if (currentHash(current) !== transaction.afterHash) {
    return {
      ok: false,
      reason: 'Cannot undo because the document changed after apply.',
    };
  }
  return { ok: true, resume: deepClone(transaction.before) };
}

/** Re-export helpers used by callers that build editor-specific transactions. */
export { canonicalStringify, deepEqual };
