import { generateObject, type LanguageModel } from 'ai';
import { assertFitsBudget } from './budget';
import { AiError, normalizeProviderError } from './errors';
import { createConnectionModel } from './providers';
import { SYSTEM_PROMPT, buildUserMessage } from './prompt';
import { restoreWithheldFields } from './resumePayload';
import { TailoringGenerationSchema } from './schemas';
import type {
  ConnectionProfile,
  TailoringAnalysis,
  TailoringEvent,
  TailoringRequestIdentity,
} from './types';
import { TailoringValidationError, assertJsonResumeValid, validateTailoredResponse } from './validate';

export interface RuntimeRequest {
  /** Optional pre-built model. The browser client normally lets the package build it. */
  model?: LanguageModel;
  connection: ConnectionProfile;
  identity: TailoringRequestIdentity;
  /** Full editor resume. Used to restore withheld fields into the preview. */
  sourceResume: Record<string, unknown>;
  /** Resume payload with contact fields already withheld. */
  resume: Record<string, unknown>;
  withheldPaths: string[];
  jobDescription: string;
  userConstraints?: string;
  abortSignal: AbortSignal;
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildAnalysis(
  request: RuntimeRequest,
  response: TailoringAnalysis['response'],
): TailoringAnalysis {
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

function assertFinished(finishReason: string | undefined, maxOutputTokens: number): void {
  if (finishReason === 'length') {
    throw new AiError(
      'CONTEXT_TOO_LARGE',
      `The model hit the ${maxOutputTokens}-token output limit before finishing the JSON object. Raise the output limit or use a model that emits less reasoning. Nothing was applied.`,
      false,
    );
  }
  if (finishReason === 'content-filter') {
    throw new AiError('REFUSED', 'The model stopped on a content filter.', false);
  }
}

/** Provider-independent generation. Local Ollama is the only provider. */
export async function* runTailoring(request: RuntimeRequest): AsyncGenerator<TailoringEvent> {
  try {
    if (!request.jobDescription.trim()) {
      throw new AiError('INVALID_CONFIGURATION', 'Job description is required.', false);
    }
    if (request.connection.contextTokens <= 0 || request.connection.maxOutputTokens <= 0) {
      throw new AiError(
        'INVALID_CONFIGURATION',
        'Context window and max output tokens must be configured.',
        false,
      );
    }
    if (request.connection.maxOutputTokens >= request.connection.contextTokens) {
      throw new AiError(
        'INVALID_CONFIGURATION',
        'Max output tokens must be smaller than the model context window.',
        false,
      );
    }

    const model = request.model ?? createConnectionModel(request.connection);

    const userPayload = buildUserMessage({
      resume: request.resume,
      jobDescription: request.jobDescription,
      userConstraints: request.userConstraints,
    });

    assertFitsBudget({
      system: SYSTEM_PROMPT,
      userPayload,
      maxOutputTokens: request.connection.maxOutputTokens,
      contextTokens: request.connection.contextTokens,
    });

    yield {
      type: 'assistant-text',
      requestId: request.identity.requestId,
      text: 'Tailoring resume…',
    };

    const result = await generateObject({
      model,
      system: SYSTEM_PROMPT,
      prompt: userPayload,
      schema: TailoringGenerationSchema,
      schemaName: 'TailoringResponse',
      schemaDescription:
        'One JSON object with exactly resume, changes, and gaps. The resume must equal the source with every listed change applied.',
      maxOutputTokens: request.connection.maxOutputTokens,
      maxRetries: 0,
      temperature: 0,
      abortSignal: request.abortSignal,
    });

    assertFinished(result.finishReason, request.connection.maxOutputTokens);

    const validated = validateTailoredResponse(result.object, request.resume, {
      jobDescription: request.jobDescription,
    });
    const restored: TailoringAnalysis['response'] = {
      ...validated,
      resume: restoreWithheldFields(
        request.sourceResume,
        validated.resume,
        request.withheldPaths,
      ),
    };

    await assertJsonResumeValid(restored.resume);

    const analysis = buildAnalysis(request, restored);
    yield {
      type: 'assistant-text',
      requestId: request.identity.requestId,
      text: `Tailoring ready: ${restored.changes.length} change${
        restored.changes.length === 1 ? '' : 's'
      }, ${restored.gaps.length} gap${restored.gaps.length === 1 ? '' : 's'}.`,
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
    if (error instanceof TailoringValidationError) {
      yield {
        type: 'error',
        requestId: request.identity.requestId,
        code: 'INVALID_OUTPUT',
        message: error.message,
      };
      return;
    }
    if (error instanceof AiError) {
      yield {
        type: 'error',
        requestId: request.identity.requestId,
        code: error.code,
        message: error.message,
      };
      return;
    }
    const normalized = normalizeProviderError(error);
    yield {
      type: 'error',
      requestId: request.identity.requestId,
      code: normalized.code,
      message: normalized.message,
    };
  }
}

/** One-shot convenience API for tests and future surfaces. */
export async function tailorResume(request: RuntimeRequest): Promise<TailoringAnalysis> {
  let analysis: TailoringAnalysis | null = null;
  let failure: TailoringEvent | null = null;
  for await (const event of runTailoring(request)) {
    if (event.type === 'analysis') analysis = event.analysis;
    if (event.type === 'error') failure = event;
  }
  if (failure && failure.type === 'error') {
    throw new AiError(failure.code, failure.message, false);
  }
  if (!analysis) {
    throw new AiError('INVALID_OUTPUT', 'The model produced no analysis.', false);
  }
  return analysis;
}

export async function pingModel(input: {
  model: LanguageModel;
  abortSignal: AbortSignal;
  maxOutputTokens?: number;
}): Promise<void> {
  const { generateText } = await import('ai');
  const result = await generateText({
    model: input.model,
    prompt: 'Reply with exactly: OK',
    maxOutputTokens: input.maxOutputTokens ?? 128,
    maxRetries: 0,
    abortSignal: input.abortSignal,
    temperature: 0,
  });
  if (
    !result.text.trim() &&
    !result.reasoningText?.trim() &&
    result.finishReason !== 'stop' &&
    result.finishReason !== 'length'
  ) {
    throw new AiError(
      'CONNECTION_FAILED',
      `Ollama completed the request without usable output (finish reason: ${
        result.finishReason ?? 'unknown'
      }).`,
      false,
    );
  }
}
