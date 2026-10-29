import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { AiError } from './errors';

export function validateLocalEndpoint(endpoint: string): URL {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new AiError('INVALID_CONFIGURATION', 'Ollama endpoint URL is invalid.', false);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AiError(
      'INVALID_CONFIGURATION',
      'Ollama endpoint must use http or https.',
      false,
    );
  }

  const host = url.hostname.toLowerCase();
  const loopback =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    host === '::1';
  if (!loopback) {
    throw new AiError(
      'INVALID_CONFIGURATION',
      'Ollama endpoint must use a loopback hostname (localhost, 127.0.0.1, or ::1).',
      false,
    );
  }

  if (url.username || url.password) {
    throw new AiError(
      'INVALID_CONFIGURATION',
      'Ollama endpoint must not embed credentials.',
      false,
    );
  }

  if (url.search && /(?:api[_-]?key|token|secret|password)=/i.test(url.search)) {
    throw new AiError(
      'INVALID_CONFIGURATION',
      'Ollama endpoint query must not contain credentials.',
      false,
    );
  }

  const path = url.pathname.replace(/\/+$/, '') || '';
  if (path && path !== '/v1' && !path.endsWith('/v1')) {
    throw new AiError(
      'INVALID_CONFIGURATION',
      'Ollama OpenAI-compatible base path should end with /v1.',
      false,
    );
  }

  return url;
}

export function normalizeOllamaBaseUrl(endpoint: string): string {
  const url = validateLocalEndpoint(endpoint);
  let base = `${url.protocol}//${url.host}${url.pathname}`.replace(/\/+$/, '');
  if (!base.endsWith('/v1')) base = `${base}/v1`;
  return base;
}

/**
 * Construct an Ollama-backed model through the Vercel AI SDK. Ollama exposes
 * an OpenAI-compatible API; this provider keeps every inference call inside
 * the SDK and never calls Ollama's REST endpoints directly.
 */
export function createOllamaModel(input: {
  endpoint: string;
  model: string;
}): LanguageModel {
  if (!input.model.trim()) {
    throw new AiError('INVALID_CONFIGURATION', 'Select an installed Ollama model.', false);
  }

  const provider = createOpenAICompatible({
    name: 'ollama',
    baseURL: normalizeOllamaBaseUrl(input.endpoint),
    apiKey: 'ollama-local',
    // Ollama supports JSON schema response formats for structured output.
    // Keep the completion budget high enough for Ollama's schema converter.
    supportsStructuredOutputs: true,
    // Ollama's OpenAI-compatible server does not need an API key.
    includeUsage: true,
  });

  return provider.chatModel(input.model);
}
