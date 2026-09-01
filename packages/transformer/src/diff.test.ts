import { describe, expect, it } from 'vitest';
import { scalarEqual, diffScalars, diffById, reorderSet } from './diff';

describe('scalarEqual', () => {
  it('treats undefined, null, and empty string as equal', () => {
    expect(scalarEqual(undefined, null)).toBe(true);
    expect(scalarEqual(null, '')).toBe(true);
    expect(scalarEqual('', undefined)).toBe(true);
  });

  it('treats equal primitives as equal', () => {
    expect(scalarEqual('hello', 'hello')).toBe(true);
    expect(scalarEqual(42, 42)).toBe(true);
  });

  it('treats different values as not equal', () => {
    expect(scalarEqual('a', 'b')).toBe(false);
    expect(scalarEqual(1, 2)).toBe(false);
  });

  it('handles nested objects by reference', () => {
    const obj = { x: 1 };
    expect(scalarEqual(obj, obj)).toBe(true);
    expect(scalarEqual(obj, { x: 1 })).toBe(false);
  });
});

describe('diffScalars', () => {
  it('returns empty when current is undefined', () => {
    expect(diffScalars(undefined, { a: 1 })).toEqual({});
  });

  it('returns empty when nothing changed', () => {
    expect(diffScalars({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toEqual({});
  });

  it('detects changed keys', () => {
    expect(diffScalars({ a: 2, b: 'x' }, { a: 1, b: 'x' })).toEqual({ a: 2 });
  });

  it('treats undefined/null/empty as equal', () => {
    expect(diffScalars({ a: '' }, { a: undefined })).toEqual({});
    expect(diffScalars({ a: null }, { a: '' })).toEqual({});
  });

  it('ignores keys in original not present in current', () => {
    expect(diffScalars({ a: 1 }, { a: 1, b: 99 })).toEqual({});
  });
});

describe('diffById', () => {
  it('detects created items (no id)', () => {
    const result = diffById([{ name: 'new' } as { id?: string }], []);
    expect(result.created).toEqual([{ name: 'new' }]);
    expect(result.updated).toEqual([]);
    expect(result.deleted).toEqual([]);
  });

  it('detects updated items', () => {
    const result = diffById(
      [{ id: '1', name: 'B' }],
      [{ id: '1', name: 'A' }],
    );
    expect(result.updated).toEqual([
      { id: '1', item: { id: '1', name: 'B' }, changed: { name: 'B' } },
    ]);
    expect(result.created).toEqual([]);
    expect(result.deleted).toEqual([]);
  });

  it('detects deleted items', () => {
    const result = diffById([], [{ id: '1', name: 'A' }]);
    expect(result.deleted).toEqual(['1']);
    expect(result.created).toEqual([]);
    expect(result.updated).toEqual([]);
  });

  it('treats item with unknown id as created', () => {
    const result = diffById(
      [{ id: 'new-id', name: 'X' }],
      [{ id: 'old-id', name: 'A' }],
    );
    expect(result.created).toHaveLength(1);
    expect(result.deleted).toEqual(['old-id']);
  });
});

describe('reorderSet', () => {
  it('returns null when order is unchanged', () => {
    const items = [{ id: '1' }, { id: '2' }];
    expect(reorderSet(items, items)).toBeNull();
  });

  it('returns new order when order changed', () => {
    const original = [{ id: '1' }, { id: '2' }];
    const current = [{ id: '2' }, { id: '1' }];
    expect(reorderSet(current, original)).toEqual([{ id: '2' }, { id: '1' }]);
  });

  it('returns set when length changed', () => {
    const original = [{ id: '1' }];
    const current = [{ id: '1' }, { id: '2' }];
    expect(reorderSet(current, original)).toEqual([{ id: '1' }, { id: '2' }]);
  });
});
