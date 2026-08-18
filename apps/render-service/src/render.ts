import { createHash } from 'node:crypto';
import { render as resumedRender } from 'resumed';
import type { JsonResume } from '@resume-studio/transformer';
import type { ThemeId } from '@resume-studio/themes';
import { htmlCache } from './cache.js';
import { postProcess } from './postProcess.js';

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

/**
 * Render a resume with the given theme. Wraps upstream theme errors in a
 * self-contained HTML error card so the iframe stays functional (the
 * `elegant` theme is known to throw on missing sections — see PLAN §10.4).
 */
export async function renderResume(resume: JsonResume, theme: ThemeId): Promise<string> {
  const key = hashKey(resume, theme);
  const cached = htmlCache.get(key);
  if (cached) return cached;

  const themeModule = await themePromises[theme];
  let html: string;
  try {
    html = await resumedRender(resume, themeModule.default ?? themeModule);
  } catch (err) {
    html = renderErrorCard(theme, err);
  }
  const processed = postProcess(html);
  htmlCache.set(key, processed);
  return processed;
}

function renderErrorCard(theme: ThemeId, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const escaped = message.replace(/[&<>]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;',
  );
  return `<!doctype html><html><body style="font-family:system-ui;padding:2rem;color:#7f1d1d;background:#fef2f2">
    <h2 style="margin:0 0 0.5rem">Theme "${theme}" failed to render</h2>
    <pre style="white-space:pre-wrap;font-size:0.85rem">${escaped}</pre>
    <p style="color:#991b1b;font-size:0.85rem">Editing continues — pick a different theme or fill missing fields.</p>
  </body></html>`;
}
