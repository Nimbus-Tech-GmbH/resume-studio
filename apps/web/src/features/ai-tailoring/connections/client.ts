import type {
  ConnectionProfile,
  ConnectionResult,
  TailoringEvent,
  TailoringRequestIdentity,
} from '@resume-studio/ai';
import { connectionForRequest } from './providers';

export interface TailoringRunRequest {
  identity: TailoringRequestIdentity;
  connection: ConnectionProfile;
  /** Full editor resume, used to restore withheld fields into the preview. */
  sourceResume: Record<string, unknown>;
  resume: Record<string, unknown>;
  withheldPaths: string[];
  jobDescription: string;
  userConstraints?: string;
  abortSignal: AbortSignal;
  onEvent: (event: TailoringEvent) => void;
}

function diagnoseFailure(error: unknown, connection: ConnectionProfile): string {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  const origin = typeof window !== 'undefined' ? window.location.origin : '(unknown origin)';

  if (connection.providerId === 'opencode') {
    if (/failed to fetch|networkerror|load failed/i.test(message)) {
      return [
        `Could not reach the OpenCode inference API at ${connection.endpoint}.`,
        `Current app origin: ${origin}.`,
        'Check the API key, network access, and that the selected model is available on your OpenCode plan.',
      ].join(' ');
    }
    return message || `Could not reach the OpenCode inference API at ${connection.endpoint}.`;
  }

  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return [
      `Could not reach Ollama at ${connection.endpoint}.`,
      `Current app origin: ${origin}.`,
      'Permit this exact origin via OLLAMA_ORIGINS (do not use *).',
      'Chrome may also require Local Network Access permission for loopback from a public site.',
      'Check Ollama is running and CORS allows this origin.',
    ].join(' ');
  }
  if (/cors/i.test(lower)) {
    return `CORS blocked local access to ${connection.endpoint}. Permit origin ${origin} on Ollama.`;
  }
  if (/permission|local network/i.test(lower)) {
    return `Browser denied local-network access to ${connection.endpoint}. Grant Local Network Access for ${origin}.`;
  }
  return message || 'Ollama connection failed.';
}

/**
 * The browser talks directly to the configured provider through the Vercel AI
 * SDK. Ollama is loopback-only; OpenCode inference is reached over HTTPS with
 * an API key. There is no server-side /api/ai proxy.
 */
export async function runTailoringRequest(request: TailoringRunRequest): Promise<void> {
  const { runTailoring, normalizeProviderError } = await import('@resume-studio/ai/browser');

  try {
    for await (const event of runTailoring({
      connection: connectionForRequest(request.connection),
      identity: request.identity,
      sourceResume: request.sourceResume,
      resume: request.resume,
      withheldPaths: request.withheldPaths,
      jobDescription: request.jobDescription,
      userConstraints: request.userConstraints,
      abortSignal: request.abortSignal,
    })) {
      request.onEvent(event);
    }
  } catch (error) {
    const normalized = normalizeProviderError(error);
    request.onEvent({
      type: 'error',
      requestId: request.identity.requestId,
      code: normalized.code,
      message:
        normalized.code === 'CONNECTION_FAILED'
          ? diagnoseFailure(error, request.connection)
          : normalized.message,
    });
  }
}

export async function testAiConnection(connection: ConnectionProfile): Promise<ConnectionResult> {
  const { testConnection } = await import('@resume-studio/ai/browser');
  return testConnection(connectionForRequest(connection));
}
