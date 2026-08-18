/**
 * Small diff helpers used by `toCms`.
 * Kept in a separate file so unit tests can exercise them in isolation.
 */

/** Returns true when two scalar values are semantically equal for the CMS. */
export function scalarEqual(a: unknown, b: unknown): boolean {
  const na = a === undefined || a === null || a === '' ? null : a;
  const nb = b === undefined || b === null || b === '' ? null : b;
  return na === nb;
}

/** Shallow diff: keys where `current[k]` differs from `original[k]`. */
export function diffScalars<T extends Record<string, unknown>>(
  current: T | undefined,
  original: T | undefined,
): Partial<T> {
  const out: Record<string, unknown> = {};
  if (!current) return out as Partial<T>;
  const orig = original ?? ({} as T);
  for (const key of Object.keys(current)) {
    if (!scalarEqual(current[key], orig[key])) {
      out[key] = current[key];
    }
  }
  return out as Partial<T>;
}

/**
 * List diff by stable id. Returns three groups:
 *   - `created`: items present in current but not in original (no id)
 *   - `updated`: items where a scalar field changed
 *   - `deleted`: ids present in original but missing from current
 */
export interface ListDiffResult<T extends { id?: string }> {
  created: T[];
  updated: Array<{ id: string; item: T; changed: Partial<T> }>;
  deleted: string[];
}

export function diffById<T extends { id?: string }>(
  current: readonly T[],
  original: readonly T[],
): ListDiffResult<T> {
  const originalById = new Map(original.filter((o) => o.id).map((o) => [o.id as string, o]));
  const currentIds = new Set(current.map((c) => c.id).filter((x): x is string => Boolean(x)));

  const created: T[] = [];
  const updated: ListDiffResult<T>['updated'] = [];
  for (const item of current) {
    if (!item.id) {
      created.push(item);
      continue;
    }
    const orig = originalById.get(item.id);
    if (!orig) {
      created.push(item);
      continue;
    }
    const changed = diffScalars(
      item as Record<string, unknown>,
      orig as Record<string, unknown>,
    );
    // Remove `id` from the change set — never patch id.
    delete (changed as Record<string, unknown>).id;
    if (Object.keys(changed).length > 0) {
      updated.push({ id: item.id, item, changed: changed as Partial<T> });
    }
  }
  const deleted: string[] = [];
  for (const id of originalById.keys()) {
    if (!currentIds.has(id)) deleted.push(id);
  }
  return { created, updated, deleted };
}

/**
 * Compute the ordered `set` array for a Keystone many-relation reorder.
 * Returns `null` if the order is unchanged, so callers can skip emitting an op.
 */
export function reorderSet<T extends { id?: string }>(
  current: readonly T[],
  original: readonly T[],
): Array<{ id: string }> | null {
  const currentIds = current.map((c) => c.id).filter((x): x is string => Boolean(x));
  const originalIds = original.map((o) => o.id).filter((x): x is string => Boolean(x));
  if (currentIds.length !== originalIds.length) {
    return currentIds.map((id) => ({ id }));
  }
  for (let i = 0; i < currentIds.length; i += 1) {
    if (currentIds[i] !== originalIds[i]) {
      return currentIds.map((id) => ({ id }));
    }
  }
  return null;
}
