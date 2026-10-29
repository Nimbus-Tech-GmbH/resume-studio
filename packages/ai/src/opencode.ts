import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { AiError } from './errors';

export const OPENCODE_DEFAULT_ENDPOINT =
  'https://opencode.ai/inference/openai/v1';

export interface OpencodeModelInput {
  endpoint: string;
  model: string;
  apiKey?: string;
}

export function validateOpencodeEndpoint(endpoint: string): URL {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new AiError('INVALID_CONFIGURATION', 'OpenCode inference URL is invalid.', false);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AiError(
      'INVALID_CONFIGURATION',
      'OpenCode inference URL must use http or https.',
      false,
    );
  }

  if (url.username || url.password) {
    throw new AiError(
      'INVALID_CONFIGURATION',
      'OpenCode inference URL must not embed credentials. Use the API key field.',
      false,
    );
  }

  if (url.search && /(?:api[_-]?key|token|secret|password)=/i.test(url.search)) {
    throw new AiError(
      'INVALID_CONFIGURATION',
      'OpenCode inference URL query must not contain credentials. Use the API key field.',
      false,
    );
  }

  return url;
}

/**
 * Normalize the Chat Completions base URL. The full OpenCode inference URL is
 * `https://opencode.ai/inference/openai/v1`; bare origins and the shared
 * `/inference` root are expanded to that path.
 */
export function normalizeOpencodeBaseUrl(endpoint: string): string {
  const url = validateOpencodeEndpoint(endpoint);
  let path = url.pathname.replace(/\/+$/, '');
  if (!path) path = '/inference/openai/v1';
  if (path === '/inference') path = '/inference/openai/v1';
  return `${url.origin}${path}`;
}

/** The model catalog lives one level above the Chat Completions family path. */
export function opencodeModelsUrl(endpoint: string): string {
  const base = normalizeOpencodeBaseUrl(endpoint);
  if (base.endsWith('/openai/v1')) {
    return `${base.slice(0, -'/openai/v1'.length)}/v1/models`;
  }
  return `${base}/models`;
}

/**
 * Construct an OpenCode inference model through Vercel's OpenAI-compatible
 * provider. OpenCode serves open-weight Chat Completions models from this
 * endpoint; API keys are sent as bearer tokens.
 */
export function createOpencodeModel(input: OpencodeModelInput): LanguageModel {
  if (!input.model.trim()) {
    throw new AiError('INVALID_CONFIGURATION', 'Select an OpenCode model.', false);
  }

  const provider = createOpenAICompatible({
    name: 'opencode',
    baseURL: normalizeOpencodeBaseUrl(input.endpoint),
    apiKey: input.apiKey?.trim() || undefined,
    includeUsage: true,
  });

  return provider.chatModel(input.model);
}
