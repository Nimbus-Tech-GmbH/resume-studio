import type { JsonResume } from '@resume-studio/transformer';
import type { ThemeId } from '@resume-studio/themes';

const RENDER_ENDPOINT =
  import.meta.env.VITE_RENDER_ENDPOINT ?? 'http://localhost:8787';

interface RenderRequest {
  resume: JsonResume;
  theme: ThemeId;
}

export async function requestRender(
  req: RenderRequest,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${RENDER_ENDPOINT}/render`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Render failed (${res.status}): ${text}`);
  }
  return res.text();
}
