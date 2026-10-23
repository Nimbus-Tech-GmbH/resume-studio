import type { PresentationInputV1 } from '@resume-studio/studio-contracts';
import type { PresentationTransport } from './controller';

export const DEFAULT_PRESENTATION_ENDPOINT = 'http://localhost:8787';

export interface HttpPresentationTransportOptions {
  readonly endpoint?: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly credentials?: RequestCredentials;
}

function renderUrl(endpoint: string): string {
  return `${endpoint.replace(/\/$/, '')}/render`;
}

export function createHttpPresentationTransport(
  options: HttpPresentationTransportOptions = {},
): PresentationTransport {
  const endpoint = options.endpoint ?? DEFAULT_PRESENTATION_ENDPOINT;
  const credentials = options.credentials ?? 'include';

  return async (input: PresentationInputV1, signal: AbortSignal): Promise<string> => {
    const fetchRequest = options.fetch ?? globalThis.fetch;
    const response = await fetchRequest(renderUrl(endpoint), {
      method: 'POST',
      credentials,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        resume: input.document.resume,
        theme: input.themeId,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Presentation render failed with status ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('text/html')) {
      throw new Error('Presentation render returned a non-HTML response');
    }

    return response.text();
  };
}

export const defaultPresentationTransport = createHttpPresentationTransport();
