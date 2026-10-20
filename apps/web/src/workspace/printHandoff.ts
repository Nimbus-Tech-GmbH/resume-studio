import { isThemeId, type ThemeId } from '@resume-studio/themes';
import type { JsonResume } from '@resume-studio/transformer';

const PRINT_KEY_PATTERN = /^print-[a-f0-9]{24}$/;
const PRINT_KEY_PREFIX = 'print-';
export const PRINT_HANDOFF_TTL_MS = 5 * 60 * 1_000;

export interface PrintPayload {
  readonly resume: JsonResume;
  readonly theme: ThemeId;
}

interface StoredPrintHandoff {
  readonly version: 1;
  readonly createdAt: number;
  readonly payload: PrintPayload;
}

export type PrintHandoffResult =
  | { readonly ok: true; readonly key: string; readonly payload: PrintPayload }
  | { readonly ok: false; readonly error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStoredHandoff(serialized: string, now: number): PrintPayload | null {
  const value: unknown = JSON.parse(serialized);
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.createdAt !== 'number' ||
    !Number.isFinite(value.createdAt) ||
    value.createdAt > now ||
    now - value.createdAt > PRINT_HANDOFF_TTL_MS ||
    !isRecord(value.payload) ||
    !isRecord(value.payload.resume) ||
    !isThemeId(value.payload.theme)
  ) {
    return null;
  }

  return { resume: value.payload.resume, theme: value.payload.theme };
}

export function removePrintHandoff(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Cleanup is best-effort after storage failures.
  }
}

export function sweepExpiredPrintHandoffs(storage: Storage, now = Date.now()): void {
  let keys: string[];
  try {
    keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
      (key): key is string => key?.startsWith(PRINT_KEY_PREFIX) === true,
    );
  } catch {
    return;
  }

  for (const key of keys) {
    try {
      const serialized = storage.getItem(key);
      if (serialized === null || parseStoredHandoff(serialized, now) === null) {
        removePrintHandoff(storage, key);
      }
    } catch {
      removePrintHandoff(storage, key);
    }
  }
}

export function createPrintKey(randomValues: Uint8Array): string {
  const hex = Array.from(randomValues, (value) => value.toString(16).padStart(2, '0')).join('');
  return `print-${hex}`;
}

export function writePrintHandoff(
  storage: Storage,
  payload: PrintPayload,
  randomValues: Uint8Array = crypto.getRandomValues(new Uint8Array(12)),
  now = Date.now(),
): string {
  sweepExpiredPrintHandoffs(storage, now);
  const key = createPrintKey(randomValues);
  const handoff: StoredPrintHandoff = { version: 1, createdAt: now, payload };
  storage.setItem(key, JSON.stringify(handoff));
  return key;
}

export function consumePrintHandoff(
  search: string,
  storage: Storage,
  now = Date.now(),
): PrintHandoffResult {
  const key = new URLSearchParams(search).get('k');
  if (!key || !PRINT_KEY_PATTERN.test(key)) {
    return { ok: false, error: 'Invalid print key format.' };
  }

  let serialized: string | null;
  try {
    serialized = storage.getItem(key);
  } catch {
    return { ok: false, error: 'Failed to read print payload from storage.' };
  }

  if (serialized === null) {
    return { ok: false, error: 'Print payload not found or expired.' };
  }

  removePrintHandoff(storage, key);

  try {
    const storedPayload = parseStoredHandoff(serialized, now);
    return storedPayload
      ? { ok: true, key, payload: storedPayload }
      : { ok: false, error: 'Invalid or expired print payload.' };
  } catch {
    return { ok: false, error: 'Invalid print payload.' };
  }
}
