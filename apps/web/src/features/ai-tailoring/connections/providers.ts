import type { ProviderId } from '@resume-studio/ai-contracts';
import type { ConnectionProfile } from '../state/tailoringStore';

export interface ProviderPreset {
  /** Label shown in the provider dropdown. */
  label: string;
  destination: ConnectionProfile['destination'];
  endpoint: string;
  model: string;
}

/**
 * Defaults per provider. Local servers run on loopback and need no
 * credential; `fm serve` (Apple Foundation Models) exposes the model `system`.
 */
export const PROVIDER_PRESETS: Record<ProviderId, ProviderPreset> = {
  mock: {
    label: 'Mock (offline)',
    destination: 'local',
    endpoint: 'http://127.0.0.1:11434/v1',
    model: 'mock',
  },
  'openai-compatible': {
    label: 'OpenAI-compatible',
    destination: 'cloud',
    endpoint: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  ollama: {
    label: 'Ollama',
    destination: 'local',
    endpoint: 'http://127.0.0.1:11434/v1',
    model: 'llama3.2',
  },
  'apple-foundation-models': {
    label: 'Apple Foundation Models (fm serve)',
    destination: 'local',
    endpoint: 'http://127.0.0.1:1976/v1',
    model: 'system',
  },
};

export function providerPreset(providerId: ProviderId): ConnectionProfile {
  const preset = PROVIDER_PRESETS[providerId];
  return {
    providerId,
    label: preset.label,
    destination: preset.destination,
    endpoint: preset.endpoint,
    model: preset.model,
  };
}
