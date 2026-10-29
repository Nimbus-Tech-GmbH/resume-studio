import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS, parseLiveProviderId, parseProviderId } from '@resume-studio/ai';
import {
  PROVIDER_PRESETS,
  connectionForPersistence,
  connectionForRequest,
  migrateConnectionProfile,
  providerPreset,
} from './providers';

describe('provider presets', () => {
  it('covers every provider id', () => {
    for (const providerId of PROVIDER_IDS) {
      expect(PROVIDER_PRESETS[providerId]).toBeDefined();
    }
  });

  it('points Ollama at the local OpenAI-compatible endpoint', () => {
    const preset = providerPreset('ollama');

    expect(preset.endpoint).toBe('http://127.0.0.1:11434/v1');
    expect(preset.destination).toBe('local');
    expect(preset.providerId).toBe('ollama');
  });

  it('presets the OpenCode provider', () => {
    const preset = providerPreset('opencode');

    expect(preset.providerId).toBe('opencode');
    expect(preset.endpoint).toBe('https://opencode.ai/inference/openai/v1');
    expect(preset.model).toBe('deepseek-v4.1-flash');
  });

  it('migrates a legacy cloud profile to the OpenCode preset', () => {
    const migrated = migrateConnectionProfile({
      providerId: 'openai',
      model: 'gpt-4o-mini',
      endpoint: 'https://api.openai.com/v1',
      destination: 'cloud',
    });

    expect(migrated.providerId).toBe('opencode');
    expect(migrated.destination).toBe('remote');
    expect(migrated.endpoint).toBe('https://opencode.ai/inference/openai/v1');
    expect(migrated.model).toBe('deepseek-v4.1-flash');
  });

  it('keeps an OpenCode endpoint, model, and API key', () => {
    const migrated = migrateConnectionProfile({
      id: 'conn_opencode',
      providerId: 'opencode',
      endpoint: 'http://127.0.0.1:5000',
      model: 'openai/gpt-5.1',
      apiKey: 'oc_sk_test',
    });

    expect(migrated.id).toBe('conn_opencode');
    expect(migrated.providerId).toBe('opencode');
    expect(migrated.endpoint).toBe('http://127.0.0.1:5000');
    expect(migrated.model).toBe('openai/gpt-5.1');
    expect(migrated.apiKey).toBe('oc_sk_test');
  });

  it('strips the OpenCode API key from persisted recovery', () => {
    const sanitized = connectionForPersistence({
      ...providerPreset('opencode'),
      apiKey: 'oc_sk_test',
    });

    expect(sanitized.apiKey).toBeUndefined();
  });

  it('routes OpenCode inference through the same-origin proxy', () => {
    const proxied = connectionForRequest({
      ...providerPreset('opencode'),
      apiKey: 'oc_sk_test',
    });

    expect(proxied.endpoint).toBe('http://localhost:5173/api/ai/opencode/openai/v1');
    expect(proxied.apiKey).toBe('oc_sk_test');
  });

  it('leaves Ollama and custom OpenCode endpoints untouched', () => {
    const ollama = providerPreset('ollama');
    expect(connectionForRequest(ollama).endpoint).toBe(ollama.endpoint);

    const custom = {
      ...providerPreset('opencode'),
      endpoint: 'https://inference.example.test/openai/v1',
    };
    expect(connectionForRequest(custom).endpoint).toBe(custom.endpoint);
  });

  it('keeps a valid local endpoint and model', () => {
    const migrated = migrateConnectionProfile({
      id: 'conn_custom',
      providerId: 'ollama',
      model: 'qwen2.5-coder:7b',
      endpoint: 'http://localhost:11434/v1',
      contextTokens: 16_384,
      maxOutputTokens: 2048,
    });

    expect(migrated.id).toBe('conn_custom');
    expect(migrated.model).toBe('qwen2.5-coder:7b');
    expect(migrated.endpoint).toBe('http://localhost:11434/v1');
    expect(migrated.contextTokens).toBe(16_384);
  });

  it('upgrades the previous undersized local limits', () => {
    const migrated = migrateConnectionProfile({
      id: 'conn_custom',
      providerId: 'ollama',
      model: 'gemma4:latest',
      endpoint: 'http://localhost:11434/v1',
      contextTokens: 4096,
      maxOutputTokens: 2048,
    });

    expect(migrated.contextTokens).toBe(32_768);
    expect(migrated.maxOutputTokens).toBe(16_384);
  });

  it('raises the previous 8192 output default', () => {
    const migrated = migrateConnectionProfile({
      id: 'conn_custom',
      providerId: 'ollama',
      model: 'gemma4:latest',
      endpoint: 'http://localhost:11434/v1',
      contextTokens: 32_768,
      maxOutputTokens: 8192,
    });

    expect(migrated.contextTokens).toBe(32_768);
    expect(migrated.maxOutputTokens).toBe(16_384);
  });
});

describe('parseProviderId', () => {
  it('accepts ollama', () => {
    expect(parseProviderId('ollama')).toBe('ollama');
  });

  it('accepts opencode', () => {
    expect(parseProviderId('opencode')).toBe('opencode');
  });

  it('rejects removed cloud providers', () => {
    expect(() => parseProviderId('openai')).toThrow('Invalid providerId');
    expect(() => parseLiveProviderId('anthropic')).toThrow('Invalid providerId');
  });

  it('rejects unknown providers for live parse', () => {
    expect(() => parseLiveProviderId('not-a-provider')).toThrow('Invalid providerId');
  });
});
