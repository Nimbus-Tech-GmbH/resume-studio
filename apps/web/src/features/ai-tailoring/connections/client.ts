import {
  AnalysisEnvelopeSchema,
  type AnalysisEnvelope,
} from '@resume-studio/ai-contracts';
import { getTailoringApiKey } from '../credentialStore';
import type { TailoringSnapshot } from '../analysis/snapshot';
import type { ConnectionProfile } from '../state/tailoringStore';

export interface AnalyzeRequest {
  workspaceId: string;
  documentEpoch: string;
  baseRevision: number;
  jobVersion: number;
  answerVersion: number;
  jobText: string;
  snapshot: TailoringSnapshot;
  connection: ConnectionProfile;
}

interface ConnectionTestResponse {
  ok: boolean;
  code?: string;
  message?: string;
}

function buildHeaders(): HeadersInit {
  const key = getTailoringApiKey();
  return {
    'content-type': 'application/json',
    ...(key ? { 'x-resume-studio-ai-key': key } : {}),
  };
}

export async function testAiConnection(connection: ConnectionProfile): Promise<ConnectionTestResponse> {
  const res = await fetch('/api/ai/test', {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      providerId: connection.providerId,
      destination: connection.destination,
      endpoint: connection.endpoint,
      model: connection.model,
    }),
  });

  const body = (await res.json()) as ConnectionTestResponse;
  if (!res.ok) {
    return {
      ok: false,
      code: body.code ?? 'CONNECTION_FAILED',
      message: body.message ?? 'Connection test failed',
    };
  }
  return body;
}

export async function runAiAnalysis(request: AnalyzeRequest): Promise<AnalysisEnvelope> {
  const res = await fetch('/api/ai/proposals', {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(request),
  });

  const body = (await res.json()) as unknown;
  if (!res.ok) {
    const maybe = body as { message?: string; code?: string };
    throw new Error(maybe.message ?? maybe.code ?? 'AI request failed');
  }

  return AnalysisEnvelopeSchema.parse(body);
}
