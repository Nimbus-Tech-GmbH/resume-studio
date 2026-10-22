function isObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function asBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Invalid ${field}`);
  return value;
}

function asOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  return asString(value, field);
}

function asOptionalNonNegativeInt(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

export type ProviderKind = 'local' | 'cloud';

/** Providers the AI service can talk to. */
export const PROVIDER_IDS = [
  'mock',
  'openai-compatible',
  'ollama',
  'apple-foundation-models',
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export function parseProviderId(input: unknown): ProviderId {
  const provider = asString(input, 'providerId');
  if ((PROVIDER_IDS as readonly string[]).includes(provider)) {
    return provider as ProviderId;
  }
  throw new Error('Invalid providerId');
}

export interface ProviderCapability {
  supportsJsonSchema: boolean;
  supportsModelListing: boolean;
  requiresCredential: boolean;
  supportsCancellation: boolean;
}

export interface ProviderDescriptor {
  id: string;
  kind: ProviderKind;
  label: string;
  capabilities: ProviderCapability;
}

export interface ConnectionRuntime {
  providerId: string;
  model: string;
  endpoint?: string;
}

export interface ConnectionResult {
  ok: boolean;
  code?: string;
  message?: string;
  latencyMs?: number;
}

export function parseProviderKind(input: unknown): ProviderKind {
  const kind = asString(input, 'provider.kind');
  if (kind === 'local' || kind === 'cloud') return kind;
  throw new Error('Invalid provider.kind');
}

export function parseProviderCapability(input: unknown): ProviderCapability {
  if (!isObject(input)) throw new Error('Invalid provider.capabilities');
  return {
    supportsJsonSchema: asBoolean(input.supportsJsonSchema, 'supportsJsonSchema'),
    supportsModelListing: asBoolean(input.supportsModelListing, 'supportsModelListing'),
    requiresCredential: asBoolean(input.requiresCredential, 'requiresCredential'),
    supportsCancellation: asBoolean(input.supportsCancellation, 'supportsCancellation'),
  };
}

export function parseProviderDescriptor(input: unknown): ProviderDescriptor {
  if (!isObject(input)) throw new Error('Invalid provider');
  return {
    id: asString(input.id, 'provider.id'),
    kind: parseProviderKind(input.kind),
    label: asString(input.label, 'provider.label'),
    capabilities: parseProviderCapability(input.capabilities),
  };
}

export function parseConnectionRuntime(input: unknown): ConnectionRuntime {
  if (!isObject(input)) throw new Error('Invalid connection runtime');
  return {
    providerId: asString(input.providerId, 'connection.providerId'),
    model: asString(input.model, 'connection.model'),
    endpoint: asOptionalString(input.endpoint, 'connection.endpoint'),
  };
}

export function parseConnectionResult(input: unknown): ConnectionResult {
  if (!isObject(input)) throw new Error('Invalid connection result');
  return {
    ok: asBoolean(input.ok, 'connection.ok'),
    code: asOptionalString(input.code, 'connection.code'),
    message: asOptionalString(input.message, 'connection.message'),
    latencyMs: asOptionalNonNegativeInt(input.latencyMs, 'connection.latencyMs'),
  };
}

export const ProviderKindSchema = { parse: parseProviderKind };
export const ProviderCapabilitySchema = { parse: parseProviderCapability };
export const ProviderDescriptorSchema = { parse: parseProviderDescriptor };
export const ConnectionRuntimeSchema = { parse: parseConnectionRuntime };
export const ConnectionResultSchema = { parse: parseConnectionResult };
