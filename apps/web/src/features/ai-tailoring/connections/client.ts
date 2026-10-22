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
  let res: Response;

  try {
    res = await fetch('/api/ai/test', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({
        providerId: connection.providerId,
        destination: connection.destination,
        endpoint: connection.endpoint,
        model: connection.model,
      }),
    });
  } catch {
    return {
      ok: false,
      code: 'CONNECTION_FAILED',
      message: 'AI service unreachable.',
    };
  }

  let body: ConnectionTestResponse;
  try {
    body = (await res.json()) as ConnectionTestResponse;
  } catch {
    return {
      ok: false,
      code: 'CONNECTION_FAILED',
      message: `AI service returned an unreadable response (HTTP ${res.status}).`,
    };
  }

  // A completed test reports its outcome in the body, so `ok: false` can come
  // back with HTTP 200.
  if (!res.ok || !body.ok) {
    return {
      ok: false,
      code: body.code ?? 'CONNECTION_FAILED',
      message: body.message ?? 'Connection test failed',
    };
  }
  return body;
}

export async function runAiAnalysis(request: AnalyzeRequest): Promise<AnalysisEnvelope> {
  let res: Response;

  try {
    res = await fetch('/api/ai/proposals', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(request),
    });
  } catch {
    throw new Error('AI service unreachable.');
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error(`AI service returned an unreadable response (HTTP ${res.status}).`);
  }

  if (!res.ok) {
    const maybe = body as { message?: string; code?: string };
    throw new Error(maybe.message ?? maybe.code ?? 'AI request failed');
  }

  return AnalysisEnvelopeSchema.parse(body);
}
