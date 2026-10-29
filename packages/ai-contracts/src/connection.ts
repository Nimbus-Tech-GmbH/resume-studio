import {
  destinationForProvider,
  parseLiveProviderId,
  type ProviderId,
} from './providers';

function isObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function asPositiveInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

/** Non-secret local connection profile. Never store a credential here. */
export interface ConnectionProfile {
  id: string;
  providerId: ProviderId;
  destination: 'local';
  endpoint: string;
  model: string;
  contextTokens: number;
  maxOutputTokens: number;
}

export function parseConnectionProfile(input: unknown): ConnectionProfile {
  if (!isObject(input)) throw new Error('Invalid connection profile');

  const providerId = parseLiveProviderId(input.providerId);
  const destination = destinationForProvider(providerId);
  const claimed =
    input.destination === undefined
      ? destination
      : asString(input.destination, 'destination');

  if (claimed !== destination) {
    throw new Error('destination must match providerId');
  }

  return {
    id: asString(input.id, 'connection.id'),
    providerId,
    destination,
    endpoint: asString(input.endpoint, 'connection.endpoint'),
    model: asString(input.model, 'connection.model'),
    contextTokens: asPositiveInt(input.contextTokens, 'connection.contextTokens'),
    maxOutputTokens: asPositiveInt(input.maxOutputTokens, 'connection.maxOutputTokens'),
  };
}

export function isConnectionConfigured(profile: ConnectionProfile): boolean {
  return (
    profile.model.trim().length > 0 &&
    profile.endpoint.trim().length > 0 &&
    profile.contextTokens > 0 &&
    profile.maxOutputTokens > 0 &&
    profile.maxOutputTokens < profile.contextTokens
  );
}

export const ConnectionProfileSchema = { parse: parseConnectionProfile };
