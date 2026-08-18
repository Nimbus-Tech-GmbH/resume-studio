/// <reference path="./shims.d.ts" />
import type { ThemeId } from './registry.js';

export type ThemeRenderFn = (resume: unknown) => string | Promise<string>;

const loaders: Record<ThemeId, () => Promise<{ render: ThemeRenderFn }>> = {
  brutalist: () => import('jsonresume-theme-brutalist') as Promise<{ render: ThemeRenderFn }>,
  claude: () => import('jsonresume-theme-claude') as Promise<{ render: ThemeRenderFn }>,
  'developer-mono': () =>
    import('jsonresume-theme-developer-mono') as Promise<{ render: ThemeRenderFn }>,
  flat: () => import('jsonresume-theme-flat') as Promise<{ render: ThemeRenderFn }>,
  'graph-paper-grid': () =>
    import('jsonresume-theme-graph-paper-grid') as Promise<{ render: ThemeRenderFn }>,
  'modern-classic': () =>
    import('jsonresume-theme-modern-classic') as Promise<{ render: ThemeRenderFn }>,
  'monochrome-noir': () =>
    import('jsonresume-theme-monochrome-noir') as Promise<{ render: ThemeRenderFn }>,
  'new-york-editorial': () =>
    import('jsonresume-theme-new-york-editorial') as Promise<{ render: ThemeRenderFn }>,
  'nordic-minimal': () =>
    import('jsonresume-theme-nordic-minimal') as Promise<{ render: ThemeRenderFn }>,
  'writers-portfolio': () =>
    import('jsonresume-theme-writers-portfolio') as Promise<{ render: ThemeRenderFn }>,
};

const cache = new Map<ThemeId, ThemeRenderFn>();

export async function renderTheme(id: ThemeId, resume: unknown): Promise<string> {
  let fn = cache.get(id);
  if (!fn) {
    const mod = await loaders[id]();
    if (typeof mod.render !== 'function') {
      throw new Error(`Theme "${id}" has no render export`);
    }
    fn = mod.render;
    cache.set(id, fn);
  }
  return await fn(resume);
}
