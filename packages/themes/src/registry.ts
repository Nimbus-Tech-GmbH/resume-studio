/**
 * Theme registry — pinned set of JSON Resume themes shipped by the render service.
 * Adding a theme = new entry here + install its package.
 */

export type ThemeId = 'stackoverflow' | 'even' | 'elegant';

export interface ThemeEntry {
  id: ThemeId;
  label: string;
  npmPackage: string;
}

export const THEMES: readonly ThemeEntry[] = [
  { id: 'stackoverflow', label: 'Stack Overflow', npmPackage: 'jsonresume-theme-stackoverflow' },
  { id: 'even', label: 'Even', npmPackage: 'jsonresume-theme-even' },
  { id: 'elegant', label: 'Elegant', npmPackage: 'jsonresume-theme-elegant' },
];

export const DEFAULT_THEME: ThemeId = 'stackoverflow';

export function isThemeId(x: unknown): x is ThemeId {
  return typeof x === 'string' && THEMES.some((t) => t.id === x);
}
