import type { AnalysisEnvelope } from './tailoring';
import { AI_ERROR_CODES, type AiErrorCode } from './errors';

function isObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function parseErrorCode(input: unknown): AiErrorCode {
  const code = asString(input, 'error.code');
  if ((AI_ERROR_CODES as readonly string[]).includes(code)) {
    return code as AiErrorCode;
  }
  throw new Error('Invalid error.code');
}

/**
 * Application stream events for local execution.
 * `assistant-text.text` is the current full text, not an append delta.
 */
export type TailoringEvent =
  | {
      type: 'assistant-text';
      requestId: string;
      text: string;
    }
  | {
      type: 'analysis';
      requestId: string;
      analysis: AnalysisEnvelope;
    }
  | {
      type: 'complete';
      requestId: string;
    }
  | {
      type: 'error';
      requestId: string;
      code: AiErrorCode;
      message: string;
    };

export function parseTailoringEvent(input: unknown): TailoringEvent {
  if (!isObject(input)) throw new Error('Invalid tailoring event');
  const type = asString(input.type, 'event.type');
  const requestId = asString(input.requestId, 'event.requestId');

  if (type === 'assistant-text') {
    if (typeof input.text !== 'string') throw new Error('Invalid event.text');
    return { type: 'assistant-text', requestId, text: input.text };
  }

  if (type === 'analysis') {
    if (!isObject(input.analysis)) throw new Error('Invalid event.analysis');
    return {
      type: 'analysis',
      requestId,
      analysis: input.analysis as unknown as AnalysisEnvelope,
    };
  }

  if (type === 'complete') {
    return { type: 'complete', requestId };
  }

  if (type === 'error') {
    return {
      type: 'error',
      requestId,
      code: parseErrorCode(input.code),
      message: typeof input.message === 'string' ? input.message : 'Request failed',
    };
  }

  throw new Error('Invalid event.type');
}

export const TailoringEventSchema = { parse: parseTailoringEvent };
