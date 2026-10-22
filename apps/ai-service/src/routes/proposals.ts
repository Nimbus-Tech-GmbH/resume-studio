import { AnalysisEnvelopeSchema } from '@resume-studio/ai-contracts';
import {
  adapterFor,
  parseDestination,
  parseProvider,
  type AnalyzeInput,
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

function asInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function parseKey(headers: Record<string, string | string[] | undefined>): string {
  const raw = headers['x-resume-studio-ai-key'];
  if (Array.isArray(raw)) return raw[0] ?? '';
  return raw ?? '';
}

export async function runProposalAnalysis(
  body: unknown,
  headers: Record<string, string | string[] | undefined>,
  signal: AbortSignal,
) {
  if (!isObject(body)) throw new Error('Invalid request body');
  if (!isObject(body.connection)) throw new Error('Invalid connection');

  const runtime: ProviderRuntime = {
    providerId: parseProvider(body.connection.providerId),
    destination: parseDestination(body.connection.destination),
    endpoint: asString(body.connection.endpoint, 'connection.endpoint'),
    model: asString(body.connection.model, 'connection.model'),
    apiKey: parseKey(headers),
  };

  const input: AnalyzeInput = {
    workspaceId: asString(body.workspaceId, 'workspaceId'),
    documentEpoch: asString(body.documentEpoch, 'documentEpoch'),
    baseRevision: asInt(body.baseRevision, 'baseRevision'),
    jobVersion: asInt(body.jobVersion, 'jobVersion'),
    answerVersion: asInt(body.answerVersion, 'answerVersion'),
    jobText: asString(body.jobText, 'jobText'),
    snapshot: body.snapshot as AnalyzeInput['snapshot'],
  };

  const adapter = adapterFor(runtime.providerId);
  const result = await adapter.analyze(input, runtime, signal);

  return AnalysisEnvelopeSchema.parse(result);
}
