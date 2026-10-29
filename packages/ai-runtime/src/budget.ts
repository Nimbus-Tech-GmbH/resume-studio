import type { ConnectionProfile } from '@resume-studio/ai-contracts';
import { AiRuntimeError } from './errors';

/**
 * Conservative English token estimate (~1 token / 3 chars) plus fixed overhead.
 * This is an estimate — not the model’s tokenizer. Fail closed on overflow.
 */
export const CHARS_PER_TOKEN = 3;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN) + 8;
}

export interface BudgetParts {
  system: string;
  userPayload: string;
  maxOutputTokens: number;
  contextTokens: number;
}

export function estimateRequestTokens(parts: BudgetParts): {
  promptTokens: number;
  reservedOutput: number;
  total: number;
  budget: number;
} {
  const promptTokens =
    estimateTokens(parts.system) +
    estimateTokens(parts.userPayload) +
    64; // protocol / message framing overhead estimate
  const reservedOutput = parts.maxOutputTokens;
  const safety = Math.ceil(parts.contextTokens * 0.05);
  const budget = parts.contextTokens - reservedOutput - safety;
  return {
    promptTokens,
    reservedOutput,
    total: promptTokens + reservedOutput,
    budget,
  };
}

export function assertFitsBudget(parts: BudgetParts): void {
  const { promptTokens, budget } = estimateRequestTokens(parts);
  if (promptTokens > budget) {
    throw new AiRuntimeError(
      'CONTEXT_TOO_LARGE',
      `Estimated prompt (${promptTokens} tokens) exceeds the configured model window after reserving ${parts.maxOutputTokens} output tokens. Select a larger-context model or reduce the job description / resume. (Estimate uses ~${CHARS_PER_TOKEN} chars/token; not the provider tokenizer.)`,
      false,
    );
  }
}

export function preflightBudget(input: {
  connection: ConnectionProfile;
  system: string;
  userPayload: string;
}): void {
  assertFitsBudget({
    system: input.system,
    userPayload: input.userPayload,
    maxOutputTokens: input.connection.maxOutputTokens,
    contextTokens: input.connection.contextTokens,
  });
}
