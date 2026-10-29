import { createOpenAI } from '@ai-sdk/openai';
import type { ProviderId } from '@resume-studio/ai-contracts';
import { AiRuntimeError } from '../errors';

const LOCAL_PLACEHOLDER_KEY = 'local-no-key';

export function isLocalProvider(providerId: ProviderId): boolean {
  return providerId === 'ollama';
}

export function validateLocalEndpoint(endpoint: string): URL {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new AiRuntimeError('INVALID_CONFIGURATION', 'Local endpoint URL is invalid.', false);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AiRuntimeError('INVALID_CONFIGURATION', 'Local endpoint must be http or https.', false);
  }

  const host = url.hostname.toLowerCase();
  const loopback =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    host === '::1';
  if (!loopback) {
    throw new AiRuntimeError(
      'INVALID_CONFIGURATION',
      'Local endpoint must use a loopback hostname.',
      false,
    );
  }

  if (url.username || url.password) {
    throw new AiRuntimeError(
      'INVALID_CONFIGURATION',
      'Local endpoint must not embed credentials.',
      false,
    );
  }

  if (url.search && /(?:api[_-]?key|token|secret|password)=/i.test(url.search)) {
    throw new AiRuntimeError(
      'INVALID_CONFIGURATION',
      'Local endpoint query must not contain credentials.',
      false,
    );
  }

  const path = url.pathname.replace(/\/+$/, '') || '';
  if (path && path !== '/v1' && !path.endsWith('/v1')) {
    throw new AiRuntimeError(
      'INVALID_CONFIGURATION',
      'Local OpenAI-compatible endpoint base path should end with /v1.',
      false,
    );
  }

  return url;
}

function normalizeLocalBaseUrl(endpoint: string): string {
  const url = validateLocalEndpoint(endpoint);
  let base = `${url.protocol}//${url.host}${url.pathname}`.replace(/\/+$/, '');
  if (!base.endsWith('/v1')) {
    base = `${base}/v1`;
  }
  return base;
}

export function createLocalModel(input: {
  providerId: ProviderId;
  endpoint: string;
  model: string;
}): unknown {
  if (!isLocalProvider(input.providerId)) {
    throw new AiRuntimeError(
      'INVALID_CONFIGURATION',
      'Only Ollama is supported.',
      false,
    );
  }
  if (!input.model.trim()) {
    throw new AiRuntimeError('INVALID_CONFIGURATION', 'Model identifier is required.', false);
  }

  const baseURL = normalizeLocalBaseUrl(input.endpoint);
  const provider = createOpenAI({
    baseURL,
    apiKey: LOCAL_PLACEHOLDER_KEY,
  });
  // Chat Completions for Ollama, not Responses API.
  return provider.chat(input.model);
}
