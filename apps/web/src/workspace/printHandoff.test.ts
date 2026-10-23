import { describe, expect, it } from 'vitest';
import type { ThemeId } from '@resume-studio/themes';
import type { JsonResume } from '@resume-studio/transformer';
import {
  consumePrintHandoff,
  createPrintKey,
  PRINT_HANDOFF_TTL_MS,
  sweepExpiredPrintHandoffs,
  writePrintHandoff,
  type PrintPayload,
} from './printHandoff';

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const resume: JsonResume = { basics: { name: 'Ada Lovelace' } };
const theme = 'modern-classic' as ThemeId;
const payload: PrintPayload = { resume, theme };
const bytes = new Uint8Array(12).fill(10);
const key = createPrintKey(bytes);

function searchFor(value: string): string {
  return `?k=${encodeURIComponent(value)}`;
}

describe('print handoff', () => {
  it('writes and consumes the expected document and theme', () => {
    const storage = new MemoryStorage();
    const writtenKey = writePrintHandoff(storage, payload, bytes);

    const result = consumePrintHandoff(searchFor(writtenKey), storage);

    expect(result).toEqual({ ok: true, key, payload });
  });

  it('rejects a missing key', () => {
    expect(consumePrintHandoff('', new MemoryStorage())).toEqual({
      ok: false,
      error: 'Invalid print key format.',
    });
  });

  it('rejects a malformed key', () => {
    expect(consumePrintHandoff('?k=not-a-print-key', new MemoryStorage())).toEqual({
      ok: false,
      error: 'Invalid print key format.',
    });
  });

  it('reports a missing payload', () => {
    expect(consumePrintHandoff(searchFor(key), new MemoryStorage())).toEqual({
      ok: false,
      error: 'Print payload not found or expired.',
    });
  });

  it('rejects invalid JSON and removes the consumed payload', () => {
    const storage = new MemoryStorage();
    storage.setItem(key, '{broken');

    expect(consumePrintHandoff(searchFor(key), storage)).toEqual({
      ok: false,
      error: 'Invalid print payload.',
    });
    expect(storage.getItem(key)).toBeNull();
  });

  it('rejects unknown themes and removes the consumed payload', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      key,
      JSON.stringify({
        version: 1,
        createdAt: 100,
        payload: { resume, theme: 'unknown-theme' },
      }),
    );

    expect(consumePrintHandoff(searchFor(key), storage, 100)).toEqual({
      ok: false,
      error: 'Invalid or expired print payload.',
    });
    expect(storage.getItem(key)).toBeNull();
  });

  it('rejects and removes expired payloads', () => {
    const storage = new MemoryStorage();
    writePrintHandoff(storage, payload, bytes, 100);

    expect(consumePrintHandoff(searchFor(key), storage, 100 + PRINT_HANDOFF_TTL_MS + 1)).toEqual({
      ok: false,
      error: 'Invalid or expired print payload.',
    });
    expect(storage.getItem(key)).toBeNull();
  });

  it('sweeps expired handoffs during a later application bootstrap', () => {
    const storage = new MemoryStorage();
    writePrintHandoff(storage, payload, bytes, 100);

    sweepExpiredPrintHandoffs(storage, 100 + PRINT_HANDOFF_TTL_MS + 1);

    expect(storage.getItem(key)).toBeNull();
  });

  it('cleans the payload before later render failure', () => {
    const storage = new MemoryStorage();
    writePrintHandoff(storage, payload, bytes, 100);

    const result = consumePrintHandoff(searchFor(key), storage, 100);
    expect(result.ok).toBe(true);
    expect(storage.getItem(key)).toBeNull();
    expect(() => {
      throw new Error('render failed');
    }).toThrow('render failed');
    expect(storage.getItem(key)).toBeNull();
  });

  it('reports unavailable storage without exposing details', () => {
    const storage = new MemoryStorage();
    storage.getItem = () => {
      throw new Error('denied');
    };

    expect(consumePrintHandoff(searchFor(key), storage)).toEqual({
      ok: false,
      error: 'Failed to read print payload from storage.',
    });
  });
});
