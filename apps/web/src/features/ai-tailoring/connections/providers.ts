import { OPENCODE_DEFAULT_ENDPOINT, type ConnectionProfile, type ProviderId } from '@resume-studio/ai';

export interface ProviderPreset {
  label: string;
  endpoint: string;
  model: string;
  contextTokens: number;
  maxOutputTokens: number;
}

export const OLLAMA_PRESET: ProviderPreset = {
  label: 'Ollama (local)',
  endpoint: 'http://127.0.0.1:11434/v1',
  model: 'gemma4:latest',
  contextTokens: 32_768,
  maxOutputTokens: 16_384,
};

export const OPENCODE_PRESET: ProviderPreset = {
  label: 'OpenCode inference',
  endpoint: OPENCODE_DEFAULT_ENDPOINT,
  model: 'deepseek-v4.1-flash',
  contextTokens: 32_768,
  maxOutputTokens: 8192,
};

const LEGACY_LOCAL_LIMITS = [
  { contextTokens: 4096, maxOutputTokens: 2048 },
  { contextTokens: 32_768, maxOutputTokens: 8192 },
];

export const PROVIDER_PRESETS: Record<ProviderId, ProviderPreset> = {
  ollama: OLLAMA_PRESET,
  opencode: OPENCODE_PRESET,
};

export function providerPreset(providerId: ProviderId = 'ollama'): ConnectionProfile {
  const preset = PROVIDER_PRESETS[providerId] ?? OLLAMA_PRESET;
  return {
    id: `conn_${providerId}`,
    providerId,
    destination: isLoopbackEndpoint(preset.endpoint) ? 'local' : 'remote',
    endpoint: preset.endpoint,
    model: preset.model,
    contextTokens: preset.contextTokens,
    maxOutputTokens: preset.maxOutputTokens,
  };
}

export function migrateConnectionProfile(input: unknown): ConnectionProfile {
  if (!input || typeof input !== 'object') return providerPreset('ollama');
  const row = input as Record<string, unknown>;
  const requestedProvider = typeof row.providerId === 'string' ? row.providerId : undefined;
  const providerId = resolveProviderId(requestedProvider, row.endpoint);
  const base = providerPreset(providerId);

  // A legacy cloud/OpenAI-compatible profile cannot be reused as an OpenCode
  // server URL, so it falls back to the OpenCode preset.
  const canKeepEndpoint =
    providerId === 'ollama'
      ? typeof row.endpoint === 'string' && isEndpointAllowed(providerId, row.endpoint)
      : requestedProvider === 'opencode' &&
        typeof row.endpoint === 'string' &&
        isEndpointAllowed(providerId, row.endpoint);
  const endpoint = canKeepEndpoint ? (row.endpoint as string) : base.endpoint;

  const persistedContext =
    typeof row.contextTokens === 'number' && row.contextTokens > 0
      ? row.contextTokens
      : base.contextTokens;
  const persistedOutput =
    typeof row.maxOutputTokens === 'number' && row.maxOutputTokens > 0
      ? row.maxOutputTokens
      : base.maxOutputTokens;

  // A previous build shipped 4096/2048 as the local defaults. That pair is
  // too small for real resumes and was persisted in browser recovery.
  const legacyLimits = LEGACY_LOCAL_LIMITS.some(
    (limits) =>
      persistedContext === limits.contextTokens &&
      persistedOutput === limits.maxOutputTokens,
  );

  return {
    ...base,
    id: typeof row.id === 'string' && row.id.trim() ? row.id : base.id,
    providerId,
    destination: isLoopbackEndpoint(endpoint) ? 'local' : 'remote',
    model:
      canKeepEndpoint && typeof row.model === 'string' && row.model.trim()
        ? row.model
        : base.model,
    endpoint,
    apiKey:
      providerId === 'opencode' && typeof row.apiKey === 'string' && row.apiKey.trim()
        ? row.apiKey.trim()
        : undefined,
    contextTokens: legacyLimits ? base.contextTokens : persistedContext,
    maxOutputTokens: legacyLimits ? base.maxOutputTokens : persistedOutput,
  };
}

/** API keys stay in memory; recovery records never contain them. */
export function connectionForPersistence(connection: ConnectionProfile): ConnectionProfile {
  if (!connection.apiKey) return connection;
  const { apiKey: _apiKey, ...rest } = connection;
  return rest;
}

/**
 * The browser cannot call OpenCode inference directly because it does not send
 * CORS headers. Route OpenCode requests through the same-origin proxy added to
 * Vite (dev) and render-service (production).
 */
export function connectionForRequest(connection: ConnectionProfile): ConnectionProfile {
  if (connection.providerId !== 'opencode') return connection;
  let upstream: URL;
  try {
    upstream = new URL(connection.endpoint);
  } catch {
    return connection;
  }
  if (upstream.origin !== 'https://opencode.ai') return connection;
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  return {
    ...connection,
    endpoint: `${origin}/api/ai/opencode/openai/v1`,
  };
}

function resolveProviderId(
  requested: string | undefined,
  endpoint: unknown,
): ProviderId {
  if (requested === 'ollama') return 'ollama';
  if (requested === 'opencode') return 'opencode';
  // Profiles written before provider ids were required are treated as Ollama
  // when they target loopback; remote legacy profiles move to OpenCode.
  if (typeof endpoint === 'string' && isHttpEndpoint(endpoint) && !isLoopbackEndpoint(endpoint)) {
    return 'opencode';
  }
  return 'ollama';
}

function isEndpointAllowed(providerId: ProviderId, value: string): boolean {
  if (!isHttpEndpoint(value)) return false;
  return providerId === 'ollama' ? isLoopbackEndpoint(value) : true;
}

function isHttpEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (url.username || url.password) return false;
    return true;
  } catch {
    return false;
  }
}

function isLoopbackEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (url.username || url.password) return false;
    return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}
