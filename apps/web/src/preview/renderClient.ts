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
    throw new Error(`Render failed with status ${res.status}`);
  }

  // Validate Content-Type to prevent MITM attacks
  const contentType = res.headers.get('content-type');
  if (!contentType?.includes('text/html')) {
    throw new Error('Invalid response type from render service');
  }

  return res.text();
}
