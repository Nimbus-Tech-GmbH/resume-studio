import { generateText, type LanguageModel } from 'ai';
import type {
  AnalysisEnvelope,
  ConnectionProfile,
  TailoringEvent,
  TailoringRequestIdentity,
} from '@resume-studio/ai-contracts';
import {
  TailoringValidationError,
  restoreWithheldFields,
  validateTailoredResponse,
} from '@resume-studio/ai-contracts';
import { assertFitsBudget } from './budget';
import { AiRuntimeError, normalizeProviderError } from './errors';
import { assertOutputFinished, parseModelJson } from './parseJson';
import { SYSTEM_PROMPT, buildMessages, buildUserMessage } from './prompt';
import { validateLocalEndpoint } from './providers/local';

export interface RuntimeRequest {
  model: LanguageModel;
  connection: ConnectionProfile;
  identity: TailoringRequestIdentity;
  /** Full editor resume. Used to restore withheld fields into the preview. */
  sourceResume: Record<string, unknown>;
  /** Resume payload with contact fields already withheld. */
  resume: Record<string, unknown>;
  withheldPaths: string[];
  jobDescription: string;
  userConstraints: string;
  abortSignal: AbortSignal;
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function* emitError(
  requestId: string,
  error: unknown,
): AsyncGenerator<TailoringEvent> {
  if (error instanceof TailoringValidationError) {
    yield {
      type: 'error',
      requestId,
      code: 'INVALID_OUTPUT',
      message: error.message,
    };
    return;
  }
  const normalized = normalizeProviderError(error);
  yield {
    type: 'error',
    requestId,
    code: normalized.code,
    message: normalized.message,
  };
}

function buildAnalysis(
  request: RuntimeRequest,
  response: AnalysisEnvelope['response'],
): AnalysisEnvelope {
  return {
    schemaVersion: 2,
    analysisId: randomId(),
    workspaceId: request.identity.workspaceId,
    documentEpoch: request.identity.documentEpoch,
    baseRevision: request.identity.baseRevision,
    snapshotHash: request.identity.snapshotHash,
    jobVersion: request.identity.jobVersion,
    withheldPaths: request.withheldPaths,
    response,
  };
}

/** Provider-independent generation. Ollama is the only supported provider. */
export async function* runTailoring(
  request: RuntimeRequest,
): AsyncGenerator<TailoringEvent> {
  try {
    if (!request.jobDescription.trim()) {
      throw new AiRuntimeError('INVALID_CONFIGURATION', 'Job description is required.', false);
    }
    if (request.connection.contextTokens <= 0 || request.connection.maxOutputTokens <= 0) {
      throw new AiRuntimeError(
        'INVALID_CONFIGURATION',
        'Context window and max output tokens must be configured.',
        false,
      );
    }
    validateLocalEndpoint(request.connection.endpoint);

    const messages = buildMessages({
      resume: request.resume,
      jobDescription: request.jobDescription,
      userConstraints: request.userConstraints,
    });

    assertFitsBudget({
      system: SYSTEM_PROMPT,
      userPayload: buildUserMessage({
        resume: request.resume,
        jobDescription: request.jobDescription,
        userConstraints: request.userConstraints,
      }),
      maxOutputTokens: request.connection.maxOutputTokens,
      contextTokens: request.connection.contextTokens,
    });

    yield {
      type: 'assistant-text',
      requestId: request.identity.requestId,
      text: 'Tailoring resume…',
    };

    const result = await generateText({
      model: request.model,
      messages,
      maxOutputTokens: request.connection.maxOutputTokens,
      maxRetries: 0,
      abortSignal: request.abortSignal,
      temperature: 0,
    });

    assertOutputFinished(result.finishReason, request.connection.maxOutputTokens);

    if (!result.text.trim()) {
      throw new AiRuntimeError(
        'INVALID_OUTPUT',
        'Model returned empty output.',
        false,
      );
    }

    const parsed = parseModelJson(result.text);
    const response = validateTailoredResponse(parsed, request.resume);
    const restored = {
      ...response,
      resume: restoreWithheldFields(
        request.sourceResume,
        response.resume,
        request.withheldPaths,
      ),
    };
    const analysis = buildAnalysis(request, restored);

    yield {
      type: 'assistant-text',
      requestId: request.identity.requestId,
      text: `Tailoring ready: ${response.changes.length} change${
        response.changes.length === 1 ? '' : 's'
      }, ${response.gaps.length} gap${response.gaps.length === 1 ? '' : 's'}.`,
    };
    yield { type: 'analysis', requestId: request.identity.requestId, analysis };
    yield { type: 'complete', requestId: request.identity.requestId };
  } catch (error) {
    if (request.abortSignal.aborted) {
      yield {
        type: 'error',
        requestId: request.identity.requestId,
        code: 'CANCELLED',
        message: 'Request cancelled.',
      };
      return;
    }
    yield* emitError(request.identity.requestId, error);
  }
}

export async function pingModel(input: {
  model: LanguageModel;
  abortSignal: AbortSignal;
  maxOutputTokens?: number;
}): Promise<void> {
  const result = await generateText({
    model: input.model,
    prompt: 'Reply with exactly: OK',
    maxOutputTokens: input.maxOutputTokens ?? 32,
    maxRetries: 0,
    abortSignal: input.abortSignal,
    temperature: 0,
  });

  if (!result.text.trim()) {
    const reason = result.finishReason ? ` finishReason=${result.finishReason}` : '';
    throw new AiRuntimeError(
      'CONNECTION_FAILED',
      `Empty model response.${reason} Check the Ollama model id.`,
      false,
    );
  }
}
