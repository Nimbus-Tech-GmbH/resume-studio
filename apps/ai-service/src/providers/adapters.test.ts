import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildFittingPrompt,
  estimateTokens,
  extractJsonObject,
  promptTokenBudget,
  type AnalyzeInput,
  type ProviderRuntime,
} from './adapters.js';

const apple: ProviderRuntime = {
  providerId: 'apple-foundation-models',
  destination: 'local',
  endpoint: 'http://127.0.0.1:1976/v1',
  model: 'system',
  apiKey: '',
};

const openai: ProviderRuntime = {
  providerId: 'openai-compatible',
  destination: 'cloud',
  endpoint: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  apiKey: 'sk-test',
};

function bigInput(): AnalyzeInput {
  const jobSentence =
    'We need a senior engineer who ships accessible React interfaces and owns the design system end to end. ';
  const highlight = (prefix: string, index: number) => ({
    highlightId: `${prefix}-h${index}`,
    value: `Led effort ${index} that improved conversion by ${index + 3}0 percent across three product lines and mentored four engineers through delivery.`,
  });

  return {
    workspaceId: 'ws_test',
    documentEpoch: 'epoch-1',
    baseRevision: 0,
    jobVersion: 1,
    answerVersion: 1,
    jobText: jobSentence.repeat(400),
    snapshot: {
      projection: {
        summary: 'Frontend engineer building accessible React design systems.',
        work: Array.from({ length: 12 }, (_, index) => ({
          entryId: `w${index}`,
          summary: `Senior engineer at company ${index} owning the component library.`,
          highlights: Array.from({ length: 8 }, (_, h) => highlight(`w${index}`, h)),
        })),
        projects: Array.from({ length: 6 }, (_, index) => ({
          entryId: `p${index}`,
          description: `Open source project ${index} for design token pipelines.`,
          highlights: Array.from({ length: 6 }, (_, h) => highlight(`p${index}`, h)),
        })),
      },
      snapshotHash: 'hhash',
    },
  };
}

describe('prompt budget', () => {
  it('reserves room for the answer inside the fm serve 8192 window', () => {
    const maxOutput = 1200;
    const budget = promptTokenBudget(apple, maxOutput);

    assert.ok(budget > 0);
    assert.ok(budget + maxOutput <= 8192, 'prompt plus answer must fit the window');
  });

  it('leaves cloud providers plenty of room', () => {
    assert.ok(promptTokenBudget(openai, 2400) > 100_000);
  });

  it('compresses a large resume and job description under the budget', () => {
    const budget = promptTokenBudget(apple, 1200);
    const { prompt, plan } = buildFittingPrompt(bigInput(), budget);

    assert.ok(
      estimateTokens(prompt) <= budget,
      `prompt estimated at ${estimateTokens(prompt)} tokens, budget ${budget}`,
    );
    assert.ok(plan.entries < 12, 'entries must be dropped for a tight window');
  });

  it('keeps everything when the budget is generous', () => {
    const { plan } = buildFittingPrompt(bigInput(), promptTokenBudget(openai, 2400));

    assert.equal(plan.jobChars, Number.POSITIVE_INFINITY);
    assert.equal(plan.entries, Number.POSITIVE_INFINITY);
  });
});

describe('extractJsonObject', () => {
  it('parses a fenced JSON block', () => {
    const parsed = extractJsonObject('Here you go:\n```json\n{"a":1}\n```') as { a: number };
    assert.equal(parsed.a, 1);
  });

  it('repairs a key that lost its opening quote', () => {
    const parsed = extractJsonObject(
      '{"proposals":[{"requirementIds":["req-1"]}],rationale":"short"}',
    ) as { rationale: string };
    assert.equal(parsed.rationale, 'short');
  });

  it('repairs a stray key echo inside a value', () => {
    const parsed = extractJsonObject(
      '{"requirements":[{"jobQuote":"summary":"Led the design system.","importance":"high"}]}',
    ) as { requirements: Array<{ jobQuote: string }> };
    assert.equal(parsed.requirements[0]?.jobQuote, 'Led the design system.');
  });

  it('closes output truncated mid-string', () => {
    const parsed = extractJsonObject(
      '{"requirements":[{"text":"Senior engineer with accessib',
    ) as { requirements: Array<{ text: string }> };
    assert.equal(parsed.requirements[0]?.text, 'Senior engineer with accessib');
  });

  it('drops a trailing comma before a closing brace', () => {
    const parsed = extractJsonObject('{"questions":[],}') as { questions: unknown[] };
    assert.deepEqual(parsed.questions, []);
  });

  it('throws when there is no object at all', () => {
    assert.throws(() => extractJsonObject('no json here'), /did not return a JSON object/);
  });
});
