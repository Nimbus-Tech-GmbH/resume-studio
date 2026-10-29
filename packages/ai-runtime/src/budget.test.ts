import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ConnectionProfile } from '@resume-studio/ai-contracts';
import { assertFitsBudget, estimateTokens, preflightBudget } from './budget.js';
import { SYSTEM_PROMPT, buildUserMessage } from './prompt.js';
import { AiRuntimeError } from './errors.js';

const connection: ConnectionProfile = {
  id: 'c1',
  providerId: 'ollama',
  destination: 'local',
  endpoint: 'http://127.0.0.1:11434/v1',
  model: 'gemma4:latest',
  contextTokens: 32_768,
  maxOutputTokens: 4096,
};

const smallConnection: ConnectionProfile = {
  ...connection,
  contextTokens: 8192,
  maxOutputTokens: 1200,
};

function userPayload(jobDescription: string): string {
  return buildUserMessage({
    resume: {
      basics: { label: 'Eng', summary: 'Builds things.' },
      work: [{ name: 'Acme', summary: 'Led platform.', highlights: ['Shipped A11y'] }],
      projects: [],
      skills: [{ name: 'TS', keywords: ['strict'] }],
    },
    jobDescription,
    userConstraints: '',
  });
}

describe('budget', () => {
  it('estimates unicode conservatively', () => {
    assert.ok(estimateTokens('東京🚀') >= 3);
  });

  it('allows exact fit under generous window', () => {
    assert.doesNotThrow(() =>
      preflightBudget({
        connection,
        system: SYSTEM_PROMPT,
        userPayload: userPayload('Need React engineer. '.repeat(20)),
      }),
    );
  });

  it('overflows before provider execution', () => {
    assert.throws(
      () =>
        preflightBudget({
          connection: smallConnection,
          system: SYSTEM_PROMPT,
          userPayload: userPayload('Need React engineer. '.repeat(20_000)),
        }),
      (error: unknown) =>
        error instanceof AiRuntimeError && error.code === 'CONTEXT_TOO_LARGE',
    );
  });

  it('counts system and user payload overhead', () => {
    assert.throws(
      () =>
        assertFitsBudget({
          system: 'x'.repeat(30_000),
          userPayload: 'y'.repeat(30_000),
          maxOutputTokens: 1200,
          contextTokens: 8192,
        }),
      (error: unknown) =>
        error instanceof AiRuntimeError && error.code === 'CONTEXT_TOO_LARGE',
    );
  });
});
