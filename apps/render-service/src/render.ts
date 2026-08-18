import { createHash } from 'node:crypto';
import { render as resumedRender } from 'resumed';
import type { JsonResume } from '@resume-studio/transformer';
import type { ThemeId } from '@resume-studio/themes';
import { htmlCache } from './cache.js';

/**
 * Preload themes once at module init so /render latency is bounded.
 * Milestone 2 also ports post-processors from
 * `nimbus-tech/scripts/generateResumeFiles/render.ts`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ThemeModule = any;

const themePromises: Record<ThemeId, Promise<ThemeModule>> = {
  stackoverflow: import('jsonresume-theme-stackoverflow'),
  even: import('jsonresume-theme-even'),
  elegant: import('jsonresume-theme-elegant'),
};

function hashKey(resume: JsonResume, theme: ThemeId): string {
  return createHash('sha1')
    .update(theme)
    .update('\0')
    .update(JSON.stringify(resume))
    .digest('hex');
}

export async function renderResume(resume: JsonResume, theme: ThemeId): Promise<string> {
  const key = hashKey(resume, theme);
  const cached = htmlCache.get(key);
  if (cached) return cached;

  const themeModule = await themePromises[theme];
  const html: string = await resumedRender(resume, themeModule.default ?? themeModule);
  htmlCache.set(key, html);
  return html;
}
