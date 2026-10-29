import { AiRuntimeError } from './errors';

/**
 * A provider can stop on the output-token limit while the JSON is still open.
 * Report that as a budget problem, not as a malformed model response.
 */
export function assertOutputFinished(
  finishReason: string | undefined,
  maxOutputTokens: number,
): void {
  if (finishReason === 'length') {
    throw new AiRuntimeError(
      'CONTEXT_TOO_LARGE',
      `Model hit the ${maxOutputTokens}-token output limit before finishing the JSON object. Raise Max output tokens in Tailoring settings, or use a model that emits less reasoning. Nothing was applied.`,
      false,
    );
  }
  if (finishReason === 'content-filter') {
    throw new AiRuntimeError('REFUSED', 'Model stopped on a content filter.', false);
  }
}

/**
 * The contract requires one JSON object and nothing else. No markdown fences,
 * prose extraction, truncation repair, or silent cleanup.
 */
export function parseModelJson(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new AiRuntimeError('INVALID_OUTPUT', 'Model returned empty output.', false);
  }
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    throw new AiRuntimeError(
      'INVALID_OUTPUT',
      'Model output must be one JSON object with no markdown or prose.',
      false,
    );
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new AiRuntimeError('INVALID_OUTPUT', 'Model returned invalid JSON.', false);
  }
}
