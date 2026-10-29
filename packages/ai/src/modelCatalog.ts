import { generateText } from 'ai';
import { AiError } from './errors';
import { normalizeOllamaBaseUrl, validateLocalEndpoint } from './ollama';
import {
  opencodeModelsUrl,
  validateOpencodeEndpoint,
} from './opencode';
import { createConnectionModel } from './providers';
import type { ConnectionProfile, ConnectionResult } from './types';

interface OpenAiModelList {
  data?: Array<{ id?: unknown }>;
}

function providerLabel(connection: ConnectionProfile): string {
  return connection.providerId === 'ollama' ? 'Ollama' : 'OpenCode inference API';
}

function sortModelIds(ids: Iterable<string>): string[] {
  return [...new Set(ids)].filter((id) => id.length > 0).sort((left, right) => left.localeCompare(right));
}

/** Discover installed models through Ollama's OpenAI-compatible model index. */
export async function listOllamaModels(
  endpoint: string,
  signal?: AbortSignal,
): Promise<string[]> {
  validateLocalEndpoint(endpoint);
  const url = `${normalizeOllamaBaseUrl(endpoint)}/models`;
  let response: Response;
  try {
    response = await fetch(url, { method: 'GET', signal });
  } catch (error) {
    throw new AiError(
      'CONNECTION_FAILED',
      `Could not reach Ollama at ${url}. Check that it is running and that OLLAMA_ORIGINS permits this app origin. ${
        error instanceof Error ? error.message : ''
      }`.trim(),
      true,
    );
  }

  if (!response.ok) {
    throw new AiError(
      'CONNECTION_FAILED',
      `Ollama model listing failed with HTTP ${response.status} ${response.statusText}.`,
      false,
    );
  }

  let body: OpenAiModelList;
  try {
    body = (await response.json()) as OpenAiModelList;
  } catch {
    throw new AiError('INVALID_OUTPUT', 'Ollama returned an invalid model listing.', false);
  }

  return sortModelIds(
    (body.data ?? []).map((row) => (typeof row.id === 'string' ? row.id : '')),
  );
}

/** Discover models exposed by the OpenCode inference API. */
export async function listOpencodeModels(
  connection: ConnectionProfile,
  signal?: AbortSignal,
): Promise<string[]> {
  validateOpencodeEndpoint(connection.endpoint);
  const url = opencodeModelsUrl(connection.endpoint);
  const apiKey = connection.apiKey?.trim();
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal,
    });
  } catch (error) {
    throw new AiError(
      'CONNECTION_FAILED',
      `Could not reach the OpenCode inference API at ${url}. ${
        error instanceof Error ? error.message : ''
      }`.trim(),
      true,
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new AiError(
      'AUTH_FAILED',
      `The OpenCode inference API rejected the API key (HTTP ${response.status}).`,
      false,
    );
  }

  if (!response.ok) {
    throw new AiError(
      'CONNECTION_FAILED',
      `OpenCode model listing failed with HTTP ${response.status} ${response.statusText}.`,
      false,
    );
  }

  let body: OpenAiModelList;
  try {
    body = (await response.json()) as OpenAiModelList;
  } catch {
    throw new AiError('INVALID_OUTPUT', 'The OpenCode inference API returned an invalid model listing.', false);
  }

  return sortModelIds(
    (body.data ?? []).map((row) => (typeof row.id === 'string' ? row.id : '')),
  );
}

export function listConnectionModels(
  connection: ConnectionProfile,
  signal?: AbortSignal,
): Promise<string[]> {
  if (connection.providerId === 'ollama') {
    return listOllamaModels(connection.endpoint, signal);
  }
  return listOpencodeModels(connection, signal);
}

export async function testConnection(connection: ConnectionProfile): Promise<ConnectionResult> {
  const started = Date.now();
  const label = providerLabel(connection);
  try {
    if (connection.providerId === 'ollama') {
      validateLocalEndpoint(connection.endpoint);
    } else {
      validateOpencodeEndpoint(connection.endpoint);
    }

    const models = await listConnectionModels(connection, AbortSignal.timeout(10_000));
    if (!models.includes(connection.model)) {
      return {
        ok: false,
        code: 'MODEL_NOT_FOUND',
        message: `Model "${connection.model}" was not found on ${label}. Available: ${
          models.join(', ') || '(none)'
        }`,
      };
    }

    const model = createConnectionModel(connection);
    const result = await generateText({
      model,
      prompt: 'Reply with exactly: OK',
      maxOutputTokens: 128,
      maxRetries: 0,
      temperature: 0,
      abortSignal: AbortSignal.timeout(20_000),
    });

    // Reasoning models can spend the whole small completion budget on hidden
    // reasoning and return no visible text. A completed request still proves
    // the endpoint and selected model are usable; only request failures should
    // fail the connection test.
    if (
      !result.text.trim() &&
      !result.reasoningText?.trim() &&
      result.finishReason !== 'stop' &&
      result.finishReason !== 'length'
    ) {
      return {
        ok: false,
        code: 'CONNECTION_FAILED',
        message: `${label} completed the connection test without usable output (finish reason: ${
          result.finishReason ?? 'unknown'
        }).`,
      };
    }

    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    if (error instanceof AiError) {
      return { ok: false, code: error.code, message: error.message };
    }
    return {
      ok: false,
      code: 'CONNECTION_FAILED',
      message: error instanceof Error ? error.message : `${label} connection failed.`,
    };
  }
}

/** Backwards-compatible alias for the Ollama-only surface. */
export function testOllamaConnection(
  connection: ConnectionProfile,
): Promise<ConnectionResult> {
  return testConnection({
    ...connection,
    providerId: 'ollama',
    destination: 'local',
  });
}
