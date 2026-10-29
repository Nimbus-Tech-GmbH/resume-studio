import {
  deepClone,
  deletePointer,
  isRecord,
  resolvePointer,
  setPointer,
} from './pointers';

/**
 * Fields withheld from the model copy and restored from the editor copy after
 * a response. The list is intentionally broader than the minimum required by
 * the product spec so identity data never leaves the browser.
 */
export const WITHHELD_PATHS = [
  '/basics/name',
  '/basics/email',
  '/basics/phone',
  '/basics/url',
  '/basics/website',
  '/basics/location',
  '/basics/profiles',
  '/basics/image',
] as const;

export interface ResumePayload {
  resume: Record<string, unknown>;
  withheldPaths: string[];
  snapshotHash: string;
}

/** Stable FNV-1a style hash for snapshot identity. */
export function stableHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `h${(hash >>> 0).toString(16)}`;
}

export function hashResume(resume: unknown): string {
  return stableHash(JSON.stringify(resume));
}

export function createResumePayload(resume: unknown): ResumePayload {
  if (!isRecord(resume)) {
    throw new Error('Resume must be an object.');
  }
  const modelResume = deepClone(resume);
  const withheldPaths: string[] = [];
  for (const path of WITHHELD_PATHS) {
    const row = resolvePointer(modelResume, path);
    if (!row.found) continue;
    withheldPaths.push(path);
    deletePointer(modelResume, path);
  }
  return {
    resume: modelResume,
    withheldPaths,
    snapshotHash: hashResume(resume),
  };
}

export function restoreWithheldFields(
  source: unknown,
  modelResume: Record<string, unknown>,
  withheldPaths: readonly string[],
): Record<string, unknown> {
  const restored = deepClone(modelResume);
  for (const path of withheldPaths) {
    const row = resolvePointer(source, path);
    if (!row.found) continue;
    setPointer(restored, path, deepClone(row.value));
  }
  return restored;
}
