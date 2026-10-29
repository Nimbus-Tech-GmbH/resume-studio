import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConnectionProfile } from '@resume-studio/ai';
import { testAiConnection } from './client';

const connection: ConnectionProfile = {
  id: 'conn_ollama',
  providerId: 'ollama',
  destination: 'local',
  endpoint: 'http://127.0.0.1:11434/v1',
  model: 'gemma4:latest',
  contextTokens: 32_768,
  maxOutputTokens: 4096,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function completionResponse(): Response {
  return jsonResponse(200, {
    id: 'chatcmpl_test',
    object: 'chat.completion',
    created: 0,
    model: connection.model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'OK' },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  });
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('testAiConnection', () => {
  it('reports a non-OK model listing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response('<html>bad gateway</html>', {
          status: 502,
          headers: { 'content-type': 'text/html' },
        }),
      ),
    );

    const result = await testAiConnection(connection);

    expect(result.ok).toBe(false);
    expect(result.code).toBe('CONNECTION_FAILED');
    expect(result.message).toContain('502');
  });

  it('reports a missing model', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(200, { data: [{ id: 'llama3.1:latest' }] })),
    );

    const result = await testAiConnection(connection);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('not found');
    expect(result.message).toContain('llama3.1:latest');
  });

  it('does not throw when Ollama is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    const result = await testAiConnection(connection);

    expect(result.ok).toBe(false);
    expect(result.code).toBe('CONNECTION_FAILED');
    expect(result.message).toContain('Could not reach Ollama');
  });

  it('probes /v1/models then pings the configured model', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = urlOf(input);
      if (url.endsWith('/v1/models')) {
        return jsonResponse(200, { data: [{ id: connection.model }] });
      }
      return completionResponse();
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await testAiConnection(connection);

    expect(result.ok).toBe(true);
    const urls = fetchMock.mock.calls.map(([input]) => urlOf(input as RequestInfo | URL));
    expect(urls[0]).toBe('http://127.0.0.1:11434/v1/models');
    expect(urls[1]).toContain('/v1/chat/completions');
  });

  it('rejects a non-loopback endpoint before any request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await testAiConnection({
      ...connection,
      endpoint: 'https://api.openai.com/v1',
    });

    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lists OpenCode inference models with an API key', async () => {
    const remote: ConnectionProfile = {
      ...connection,
      id: 'conn_opencode',
      providerId: 'opencode',
      destination: 'remote',
      endpoint: 'https://opencode.ai/inference/openai/v1',
      apiKey: 'oc_sk_test',
      model: 'deepseek-v4.1-flash',
    };
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = urlOf(input);
        expect(url).toBe('http://localhost:5173/api/ai/opencode/v1/models');
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer oc_sk_test');
        return jsonResponse(200, {
          object: 'list',
          data: [{ id: 'deepseek-v4.1-flash', object: 'model' }],
        });
      },
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await testAiConnection({ ...remote, model: 'missing-model' });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('MODEL_NOT_FOUND');
    expect(result.message).toContain('deepseek-v4.1-flash');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
