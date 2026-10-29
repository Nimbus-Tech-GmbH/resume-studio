import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LanguageModel } from 'ai';
import { AiError } from './errors';
import {
  OPENCODE_DEFAULT_ENDPOINT,
  createOpencodeModel,
  normalizeOpencodeBaseUrl,
  opencodeModelsUrl,
  validateOpencodeEndpoint,
} from './opencode';
import { createConnectionModel } from './providers';
import type { ConnectionProfile } from './types';

function connection(overrides: Partial<ConnectionProfile> = {}): ConnectionProfile {
  return {
    id: 'conn_opencode',
    providerId: 'opencode',
    destination: 'remote',
    endpoint: OPENCODE_DEFAULT_ENDPOINT,
    model: 'deepseek-v4.1-flash',
    apiKey: 'oc_sk_test',
    contextTokens: 32_768,
    maxOutputTokens: 8192,
    ...overrides,
  };
}

function modelId(model: LanguageModel): string {
  if (typeof model === 'string') return model;
  return (model as unknown as { modelId: string }).modelId;
}

describe('OpenCode inference provider', () => {
  it('defaults to the OpenCode Chat Completions endpoint', () => {
    assert.equal(
      normalizeOpencodeBaseUrl(OPENCODE_DEFAULT_ENDPOINT),
      'https://opencode.ai/inference/openai/v1',
    );
    assert.equal(
      normalizeOpencodeBaseUrl('https://opencode.ai'),
      'https://opencode.ai/inference/openai/v1',
    );
    assert.equal(
      normalizeOpencodeBaseUrl('https://opencode.ai/inference'),
      'https://opencode.ai/inference/openai/v1',
    );
  });

  it('derives the shared model catalog URL', () => {
    assert.equal(
      opencodeModelsUrl(OPENCODE_DEFAULT_ENDPOINT),
      'https://opencode.ai/inference/v1/models',
    );
    assert.equal(
      opencodeModelsUrl('http://localhost:5173/api/ai/opencode/openai/v1'),
      'http://localhost:5173/api/ai/opencode/v1/models',
    );
  });

  it('rejects embedded credentials', () => {
    assert.throws(
      () => validateOpencodeEndpoint('https://user:secret@opencode.ai/inference/openai/v1'),
      (error: unknown) => error instanceof AiError && error.code === 'INVALID_CONFIGURATION',
    );
  });

  it('builds a Chat Completions model through the OpenAI-compatible provider', () => {
    const model = createOpencodeModel({
      endpoint: OPENCODE_DEFAULT_ENDPOINT,
      model: 'deepseek-v4.1-flash',
      apiKey: 'oc_sk_test',
    });
    assert.equal(modelId(model), 'deepseek-v4.1-flash');
  });

  it('routes provider profiles to the matching model factory', () => {
    const remote = createConnectionModel(connection());
    assert.equal(modelId(remote), 'deepseek-v4.1-flash');

    const local = createConnectionModel(
      connection({
        providerId: 'ollama',
        destination: 'local',
        endpoint: 'http://127.0.0.1:11434/v1',
        model: 'gemma4:latest',
        apiKey: undefined,
      }),
    );
    assert.equal(modelId(local), 'gemma4:latest');
  });
});
