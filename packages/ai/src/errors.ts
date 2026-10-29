import { NoObjectGeneratedError } from 'ai';
import type { AiErrorCode } from './types';

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly retriable: boolean;

  constructor(code: AiErrorCode, message: string, retriable = false) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.retriable = retriable;
  }
}

/** Alias kept for the web feature and older tests. */
export class AiRuntimeError extends AiError {
  constructor(code: AiErrorCode, message: string, retriable = false) {
    super(code, message, retriable);
    this.name = 'AiRuntimeError';
  }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown provider error';
}

function statusCodeOf(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;
  if (typeof error.statusCode === 'number') return error.statusCode;
  if (typeof error.status === 'number') return error.status;
  return undefined;
}

/** Pull a short provider message without dumping request or resume bodies. */
function providerDetail(error: unknown): string | undefined {
  const primary = messageOf(error).trim();
  if (primary && primary !== 'Unknown provider error') {
    return primary.slice(0, 240);
  }

  if (!isRecord(error)) return undefined;
  const body = error.responseBody;
  if (typeof body === 'string' && body.trim()) {
    try {
      const parsed = JSON.parse(body) as unknown;
      if (isRecord(parsed) && isRecord(parsed.error) && typeof parsed.error.message === 'string') {
        return parsed.error.message.slice(0, 240);
      }
      if (isRecord(parsed) && typeof parsed.message === 'string') {
        return parsed.message.slice(0, 240);
      }
    } catch {
      return body.slice(0, 240);
    }
  }
  return undefined;
}

function withDetail(base: string, detail: string | undefined): string {
  if (!detail) return base;
  const trimmed = detail.trim();
  if (!trimmed || base.toLowerCase().includes(trimmed.toLowerCase())) return base;
  return `${base} (${trimmed})`;
}

/** Map SDK/provider failures to sanitized application codes. */
export function normalizeProviderError(error: unknown): AiRuntimeError {
  if (error instanceof AiError) return new AiRuntimeError(error.code, error.message, error.retriable);

  if (NoObjectGeneratedError.isInstance(error)) {
    if (error.finishReason === 'length') {
      return new AiRuntimeError(
        'CONTEXT_TOO_LARGE',
        'The model ran out of output tokens before finishing the JSON object, so the response was truncated. Raise Max output tokens (16384 is recommended for large resumes), then retry.',
        false,
      );
    }
    return new AiRuntimeError(
      'INVALID_OUTPUT',
      error.text?.trim()
        ? 'The model returned text that was not one complete JSON object. No partial output was applied.'
        : 'The model returned no usable JSON output.',
      false,
    );
  }

  const message = messageOf(error);
  const lower = message.toLowerCase();
  const status = statusCodeOf(error);
  const detail = providerDetail(error);

  if (error instanceof Error && error.name === 'AbortError') {
    return new AiRuntimeError('CANCELLED', 'Request cancelled.', false);
  }
  if (/abort|cancelled|canceled/i.test(message)) {
    return new AiRuntimeError('CANCELLED', 'Request cancelled.', false);
  }

  if (
    status === 401 ||
    status === 403 ||
    /401|403|unauthoriz|authentication|permission denied|forbidden/i.test(lower)
  ) {
    return new AiRuntimeError(
      'AUTH_FAILED',
      withDetail('The AI endpoint rejected the request.', detail),
      false,
    );
  }

  if (
    status === 404 ||
    /404|model.?not.?found|does not exist|unknown model|no endpoints found/i.test(lower)
  ) {
    return new AiRuntimeError(
      'MODEL_NOT_FOUND',
      withDetail('Selected model is not available on the configured provider.', detail),
      false,
    );
  }

  if (status === 429 || /429|rate.?limit|too many requests|quota/i.test(lower)) {
    return new AiRuntimeError(
      'RATE_LIMITED',
      withDetail('The provider rejected the request because it is busy.', detail),
      true,
    );
  }

  if (
    /context (size|length|window)|maximum context|too many tokens|token.?limit|prompt is too long|transcript exceeded|token ceiling|maxoutputtokens|output truncated/i.test(
      lower,
    )
  ) {
    return new AiRuntimeError(
      'CONTEXT_TOO_LARGE',
      withDetail(
        'The request or response exceeded the model token limit. Increase the context/output limit, or shorten the job description.',
        detail,
      ),
      false,
    );
  }

  if (/invalid json schema in format/i.test(lower)) {
    return new AiRuntimeError(
      'CONTEXT_TOO_LARGE',
      'The provider rejected structured output for the configured completion budget. Set Max output tokens to at least 4096 and retry.',
      false,
    );
  }

  if (status === 408 || /timeout|timed out|deadline/i.test(lower)) {
    return new AiRuntimeError('TIMEOUT', withDetail('The AI request timed out.', detail), true);
  }

  if (/refus|content.?filter|safety/i.test(lower)) {
    return new AiRuntimeError(
      'REFUSED',
      withDetail('The model refused to generate a response.', detail),
      false,
    );
  }

  if (
    /no object generated|could not parse the response|failed to parse|invalid json|json.?parse|invalid input/i.test(
      lower,
    )
  ) {
    return new AiRuntimeError(
      'INVALID_OUTPUT',
      withDetail('The model did not return one valid JSON object.', detail),
      false,
    );
  }

  if (/cors|failed to fetch|network|econnrefused|enotfound|redirect/i.test(lower)) {
    return new AiRuntimeError(
      'CONNECTION_FAILED',
      withDetail(
        'Could not reach the AI endpoint. Check that it is running and that its CORS policy permits this app origin.',
        detail,
      ),
      true,
    );
  }

  if (status !== undefined && status >= 500) {
    return new AiRuntimeError(
      'CONNECTION_FAILED',
      withDetail('The AI provider returned a server error.', detail),
      true,
    );
  }

  if (status !== undefined && status >= 400) {
    return new AiRuntimeError(
      'CONNECTION_FAILED',
      withDetail(`The AI endpoint rejected the request (HTTP ${status}).`, detail),
      false,
    );
  }

  return new AiRuntimeError(
    'CONNECTION_FAILED',
    withDetail('The AI request failed.', detail),
    true,
  );
}
