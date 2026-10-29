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
