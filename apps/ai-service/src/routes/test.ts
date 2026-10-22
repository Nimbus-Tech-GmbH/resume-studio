import {
  adapterFor,
  parseDestination,
  parseProvider,
  type ProviderRuntime,
} from '../providers/adapters.js';

function isObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function parseTestBody(body: unknown): Omit<ProviderRuntime, 'apiKey'> {
  if (!isObject(body)) throw new Error('Invalid request body');
  return {
    providerId: parseProvider(body.providerId),
    destination: parseDestination(body.destination),
    endpoint: asString(body.endpoint, 'endpoint'),
    model: asString(body.model, 'model'),
  };
}

function parseKey(headers: Record<string, string | string[] | undefined>): string {
  const raw = headers['x-resume-studio-ai-key'];
  if (Array.isArray(raw)) return raw[0] ?? '';
  return raw ?? '';
}

export async function runConnectionTest(
  body: unknown,
  headers: Record<string, string | string[] | undefined>,
  signal: AbortSignal,
) {
  const parsed = parseTestBody(body);
  const runtime: ProviderRuntime = {
    ...parsed,
    apiKey: parseKey(headers),
  };

  const adapter = adapterFor(parsed.providerId);
  return adapter.testConnection(runtime, signal);
}
