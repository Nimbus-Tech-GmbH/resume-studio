/**
 * Theme registry — dispatches to vendored jsonresume.org theme packages
 * under `packages/vendor/*`.
 */

export type ThemeId =
  | 'developer-mono'
  | 'flat'
  | 'modern-classic'
  | 'writers-portfolio'
  | 'nordic-minimal'
  | 'graph-paper-grid'
  | 'monochrome-noir'
  | 'new-york-editorial'
  | 'claude';

export interface ThemeEntry {
  id: ThemeId;
  label: string;
}

export const THEMES: readonly ThemeEntry[] = [
  { id: 'nordic-minimal', label: 'Nordic Minimal' },
  { id: 'modern-classic', label: 'Modern Classic' },
  { id: 'developer-mono', label: 'Developer Mono' },
  { id: 'graph-paper-grid', label: 'Graph Paper Grid' },
  { id: 'monochrome-noir', label: 'Monochrome Noir' },
  { id: 'new-york-editorial', label: 'New York Editorial' },
  { id: 'writers-portfolio', label: "Writer's Portfolio" },
  { id: 'flat', label: 'Flat' },
  { id: 'claude', label: 'Claude' },
];

export const DEFAULT_THEME: ThemeId = 'nordic-minimal';

export function isThemeId(x: unknown): x is ThemeId {
  return typeof x === 'string' && THEMES.some((t) => t.id === x);
}

export { renderTheme } from './themes.js';
export type { ThemeRenderFn } from './themes.js';
