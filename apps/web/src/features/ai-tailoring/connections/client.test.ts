import { afterEach, describe, expect, it, vi } from 'vitest';
import { testAiConnection } from './client';
import type { ConnectionProfile } from '../state/tailoringStore';

const connection: ConnectionProfile = {
  providerId: 'openai-compatible',
  destination: 'cloud',
  endpoint: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  label: 'OpenAI-compatible',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('testAiConnection', () => {
  it('reports a failed test that came back with HTTP 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(200, {
          ok: false,
          code: 'AUTH_FAILED',
          message: 'Missing API key.',
        }),
      ),
    );

    const result = await testAiConnection(connection);

    expect(result.ok).toBe(false);
    expect(result.code).toBe('AUTH_FAILED');
    expect(result.message).toBe('Missing API key.');
  });

  it('reports a successful test', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(200, { ok: true, latencyMs: 0 })),
    );

    const result = await testAiConnection(connection);

    expect(result.ok).toBe(true);
  });

  it('still handles a 400 body from an older service', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(400, {
          ok: false,
          code: 'AUTH_FAILED',
          message: 'Missing API key.',
        }),
      ),
    );

    const result = await testAiConnection(connection);

    expect(result.ok).toBe(false);
    expect(result.message).toBe('Missing API key.');
  });

  it('does not throw when the service returns a non-JSON body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('<html>bad gateway</html>', {
            status: 502,
            headers: { 'content-type': 'text/html' },
          }),
      ),
    );

    const result = await testAiConnection(connection);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('502');
  });

  it('does not throw when the service is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    const result = await testAiConnection(connection);

    expect(result.ok).toBe(false);
    expect(result.message).toBe('AI service unreachable.');
  });
});
