/**
 * Theme registry — in-repo themes rendered by the render service.
 */
import { themes } from './themes.js';
import type { ThemeRenderer } from './themes.js';

export type ThemeId =
  | 'developer-mono'
  | 'flat'
  | 'modern-classic'
  | 'writers-portfolio'
  | 'nordic-minimal'
  | 'graph-paper-grid'
  | 'monochrome-noir'
  | 'new-york-editorial'
  | 'claude'
  | 'brutalist';

export interface ThemeEntry {
  id: ThemeId;
  label: string;
}

export const THEMES: readonly ThemeEntry[] = [
  { id: 'developer-mono', label: 'Developer Mono' },
  { id: 'flat', label: 'Flat' },
  { id: 'modern-classic', label: 'Modern Classic' },
  { id: 'writers-portfolio', label: "Writer's Portfolio" },
  { id: 'nordic-minimal', label: 'Nordic Minimal' },
  { id: 'graph-paper-grid', label: 'Graph Paper Grid' },
  { id: 'monochrome-noir', label: 'Monochrome Noir' },
  { id: 'new-york-editorial', label: 'New York Editorial' },
  { id: 'claude', label: 'Claude' },
  { id: 'brutalist', label: 'Brutalist' },
];

export const DEFAULT_THEME: ThemeId = 'nordic-minimal';

export function isThemeId(x: unknown): x is ThemeId {
  return typeof x === 'string' && THEMES.some((t) => t.id === x);
}

export function getThemeRenderer(id: ThemeId): ThemeRenderer {
  return themes[id];
}
