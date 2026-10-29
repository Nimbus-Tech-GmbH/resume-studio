import { AiError } from './errors';

/**
 * Conservative English token estimate (~1 token / 3 chars) plus fixed
 * overhead. It is an estimate, not the model tokenizer. Overflow fails closed.
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
    estimateTokens(parts.system) + estimateTokens(parts.userPayload) + 64;
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
    throw new AiError(
      'CONTEXT_TOO_LARGE',
      `Estimated prompt (${promptTokens} tokens) exceeds the configured model window after reserving ${parts.maxOutputTokens} output tokens. Select a larger-context model or reduce the job description / resume.`,
      false,
    );
  }
}
