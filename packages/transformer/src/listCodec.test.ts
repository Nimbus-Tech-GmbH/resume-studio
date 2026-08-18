import { describe, expect, it } from 'vitest';
import { decodeList, encodeList, LIST_DELIMITER } from './listCodec.js';

describe('listCodec', () => {
  it('round-trips through the ✌🏻 delimiter', () => {
    const items = ['TypeScript', 'React', 'GraphQL'];
    expect(decodeList(encodeList(items))).toEqual(items);
  });

  it('decodes newline-delimited legacy strings', () => {
    expect(decodeList('foo\nbar\nbaz')).toEqual(['foo', 'bar', 'baz']);
  });

  it('decodes ,; fallback', () => {
    expect(decodeList('foo, bar; baz')).toEqual(['foo', 'bar', 'baz']);
  });

  it('prefers primary delimiter over commas', () => {
    expect(decodeList(`foo${LIST_DELIMITER}bar,baz`)).toEqual(['foo', 'bar,baz']);
  });

  it('handles nullish input', () => {
    expect(encodeList(undefined)).toBe('');
    expect(encodeList([])).toBe('');
    expect(decodeList(null)).toEqual([]);
    expect(decodeList('')).toEqual([]);
  });
});
