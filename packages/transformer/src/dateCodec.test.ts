import { describe, expect, it } from 'vitest';
import { decodeDate, encodeDate, isValidDateInput } from './dateCodec';

describe('dateCodec', () => {
  it('encodes YYYY-MM-DD', () => {
    expect(encodeDate('2024-03-14')).toBe('2024-03-14T00:00:00.000Z');
  });

  it('encodes YYYY-MM as day 01', () => {
    expect(encodeDate('2024-03')).toBe('2024-03-01T00:00:00.000Z');
  });

  it('decodes ISO to YYYY-MM-DD', () => {
    expect(decodeDate('2024-03-14T10:22:33.000Z')).toBe('2024-03-14');
  });

  it('null for bad input', () => {
    expect(encodeDate('not-a-date')).toBeNull();
    expect(isValidDateInput('not-a-date')).toBe(false);
  });

  it('empty is valid + null', () => {
    expect(encodeDate('')).toBeNull();
    expect(isValidDateInput('')).toBe(true);
    expect(decodeDate(undefined)).toBeUndefined();
  });
});
