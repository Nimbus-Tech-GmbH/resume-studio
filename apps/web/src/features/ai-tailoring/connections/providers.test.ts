import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS, parseProviderId } from '@resume-studio/ai-contracts';
import { PROVIDER_PRESETS, providerPreset } from './providers';

describe('provider presets', () => {
  it('covers every provider id', () => {
    for (const providerId of PROVIDER_IDS) {
      expect(PROVIDER_PRESETS[providerId]).toBeDefined();
    }
  });

  it('points Apple Foundation Models at the fm serve defaults', () => {
    const preset = providerPreset('apple-foundation-models');

    expect(preset.endpoint).toBe('http://127.0.0.1:1976/v1');
    expect(preset.model).toBe('system');
    expect(preset.destination).toBe('local');
  });

  it('points Ollama at the local OpenAI-compatible endpoint', () => {
    const preset = providerPreset('ollama');

    expect(preset.endpoint).toBe('http://127.0.0.1:11434/v1');
    expect(preset.destination).toBe('local');
  });

  it('keeps the cloud provider on https', () => {
    const preset = providerPreset('openai-compatible');

    expect(preset.endpoint).toMatch(/^https:\/\//);
    expect(preset.destination).toBe('cloud');
  });
});

describe('parseProviderId', () => {
  it('accepts apple-foundation-models', () => {
    expect(parseProviderId('apple-foundation-models')).toBe('apple-foundation-models');
  });

  it('rejects unknown providers', () => {
    expect(() => parseProviderId('not-a-provider')).toThrow('Invalid providerId');
  });
});
