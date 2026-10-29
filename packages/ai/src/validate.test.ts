import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TailoredResumeResponse, TailoringChange } from './types';
import {
  TailoringValidationError,
  validateTailoredResponse,
} from './validate';

function baseResume(): Record<string, unknown> {
  return {
    basics: {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      label: 'Cloud and Data Architect',
      summary: 'Builds platforms.',
      location: { city: 'London' },
      profiles: [{ network: 'GitHub', username: 'ada' }],
    },
    work: [
      {
        name: 'Acme',
        position: 'Engineer',
        startDate: '2020-01-01',
        summary: 'Built a platform.',
        highlights: ['Shipped the API to 3 teams.', 'Mentored 2 engineers.'],
      },
    ],
    projects: [],
    skills: [{ name: 'TypeScript', keywords: ['strict', 'react'], level: 'Advanced' }],
    custom: { note: 'keep me' },
  };
}

function change(overrides: Partial<TailoringChange>): TailoringChange {
  return {
    id: 'c1',
    group: 'g1',
    type: 'rewrite-summary',
    section: 'basics',
    entity: 'Summary',
    summary: 'Match the platform requirement.',
    path: '/basics/summary',
    op: 'rewrite',
    before: 'Builds platforms.',
    after: 'Builds resilient platforms.',
    evidence: [],
    ...overrides,
  };
}

function response(
  resume: Record<string, unknown>,
  changes: TailoringChange[],
): TailoredResumeResponse {
  return { resume, changes, gaps: [] };
}

function rewrittenSummary(): Record<string, unknown> {
  const next = structuredClone(baseResume());
  (next.basics as Record<string, unknown>).summary = 'Builds resilient platforms.';
  return next;
}

describe('validateTailoredResponse', () => {
  it('accepts a narrative rewrite described by a change', () => {
    const result = validateTailoredResponse(
      response(rewrittenSummary(), [change({})]),
      baseResume(),
    );
    assert.equal(result.changes.length, 1);
  });

  it('rejects extra top-level keys', () => {
    const parsed = { ...response(rewrittenSummary(), [change({})]), extra: true };
    assert.throws(
      () => validateTailoredResponse(parsed, baseResume()),
      (error: unknown) => error instanceof TailoringValidationError,
    );
  });

  it('rejects a missing top-level key', () => {
    assert.throws(
      () => validateTailoredResponse({ resume: rewrittenSummary(), changes: [] }, baseResume()),
      TailoringValidationError,
    );
  });

  it('rejects a change to an immutable work field', () => {
    const next = rewrittenSummary();
    (next.work as Array<Record<string, unknown>>)[0]!.position = 'Staff Engineer';
    assert.throws(
      () =>
        validateTailoredResponse(
          response(next, [
            change({}),
            change({
              id: 'c2',
              type: 'rewrite-work-highlight',
              section: 'work',
              entity: 'Acme',
              path: '/work/0/position',
              before: 'Engineer',
              after: 'Staff Engineer',
            }),
          ]),
          baseResume(),
        ),
      /unsupported path/,
    );
  });

  it('rejects a new skill keyword disguised as a reorder', () => {
    const next = rewrittenSummary();
    (next.skills as Array<Record<string, unknown>>)[0]!.keywords = [
      'strict',
      'react',
      'graphql',
    ];
    assert.throws(
      () =>
        validateTailoredResponse(
          response(next, [
            change({}),
            change({
              id: 'c2',
              type: 'reorder-skills',
              section: 'skills',
              entity: 'TypeScript',
              path: '/skills/0/keywords',
              op: 'reorder',
              before: ['strict', 'react'],
              after: ['strict', 'react', 'graphql'],
            }),
          ]),
          baseResume(),
        ),
      /only change order/,
    );
  });

  it('allows reordering skills', () => {
    const next = rewrittenSummary();
    next.skills = [{ name: 'TypeScript', keywords: ['react', 'strict'], level: 'Advanced' }];
    const result = validateTailoredResponse(
      response(next, [
        change({}),
        change({
          id: 'c2',
          type: 'reorder-skills',
          section: 'skills',
          entity: 'TypeScript',
          path: '/skills/0/keywords',
          op: 'reorder',
          before: ['strict', 'react'],
          after: ['react', 'strict'],
        }),
      ]),
      baseResume(),
    );
    assert.equal(result.changes.length, 2);
  });

  it('rejects a label that adds a meaningful word', () => {
    const next = rewrittenSummary();
    (next.basics as Record<string, unknown>).label = 'Staff Architect';
    assert.throws(
      () =>
        validateTailoredResponse(
          response(next, [
            change({}),
            change({
              id: 'c2',
              type: 'narrow-label',
              section: 'basics',
              entity: 'Headline',
              path: '/basics/label',
              op: 'narrow',
              before: 'Cloud and Data Architect',
              after: 'Staff Architect',
            }),
          ]),
          baseResume(),
        ),
      /adds a meaningful word/,
    );
  });

  it('allows narrowing a label to its existing words', () => {
    const next = rewrittenSummary();
    (next.basics as Record<string, unknown>).label = 'Cloud Architect';
    const result = validateTailoredResponse(
      response(next, [
        change({}),
        change({
          id: 'c2',
          type: 'narrow-label',
          section: 'basics',
          entity: 'Headline',
          path: '/basics/label',
          op: 'narrow',
          before: 'Cloud and Data Architect',
          after: 'Cloud Architect',
        }),
      ]),
      baseResume(),
    );
    assert.equal(result.changes.length, 2);
  });

  it('allows a label that only changes word breaks or punctuation', () => {
    const source = baseResume();
    (source.basics as Record<string, unknown>).label = 'Node.js / Full-Stack Developer';
    const next = structuredClone(source);
    (next.basics as Record<string, unknown>).label = 'NodeJS Full Stack Developer';
    const result = validateTailoredResponse(
      response(next, [
        change({
          type: 'narrow-label',
          section: 'basics',
          entity: 'Headline',
          path: '/basics/label',
          op: 'narrow',
          before: 'Node.js / Full-Stack Developer',
          after: 'NodeJS Full Stack Developer',
        }),
      ]),
      source,
    );
    assert.equal(result.changes.length, 1);
  });

  it('rejects a deleted highlight that no kept highlight covers', () => {
    const next = rewrittenSummary();
    const row = (next.work as Array<Record<string, unknown>>)[0]!;
    row.highlights = ['Mentored 2 engineers.'];
    assert.throws(
      () =>
        validateTailoredResponse(
          response(next, [
            change({}),
            change({
              id: 'c2',
              type: 'delete-work-highlight',
              section: 'work',
              entity: 'Acme',
              path: '/work/0/highlights/0',
              op: 'delete',
              before: 'Shipped the API to 3 teams.',
              after: null,
            }),
          ]),
          baseResume(),
        ),
      /no kept highlight covers/,
    );
  });

  it('allows deleting a duplicate highlight covered by a kept one', () => {
    const source = baseResume();
    (source.work as Array<Record<string, unknown>>)[0]!.highlights = [
      'Shipped the API to 3 teams.',
      'Shipped the API to 3 teams.',
    ];
    const next = structuredClone(source);
    (next.basics as Record<string, unknown>).summary = 'Builds resilient platforms.';
    (next.work as Array<Record<string, unknown>>)[0]!.highlights = [
      'Shipped the API to 3 teams.',
    ];
    const result = validateTailoredResponse(
      response(next, [
        change({}),
        change({
          id: 'c2',
          type: 'delete-work-highlight',
          section: 'work',
          entity: 'Acme',
          path: '/work/0/highlights/1',
          op: 'delete',
          before: 'Shipped the API to 3 teams.',
          after: null,
        }),
      ]),
      source,
    );
    assert.equal(result.changes.length, 2);
  });

  it('rejects a new unsupported number in prose', () => {
    const next = rewrittenSummary();
    (next.basics as Record<string, unknown>).summary = 'Reduced latency by 40%.';
    assert.throws(
      () =>
        validateTailoredResponse(
          response(next, [change({ after: 'Reduced latency by 40%.' })]),
          baseResume(),
        ),
      /adds a number/,
    );
  });

  it('does not reject capitalized terms based on the job description', () => {
    const next = rewrittenSummary();
    (next.basics as Record<string, unknown>).summary = 'Builds Kubernetes platforms.';
    const result = validateTailoredResponse(
      response(next, [change({ after: 'Builds Kubernetes platforms.' })]),
      baseResume(),
      { jobDescription: 'We need Kubernetes experience.' },
    );
    assert.equal(result.changes.length, 1);
  });

  it('allows ordinary capitalized words such as Cost', () => {
    const next = rewrittenSummary();
    (next.basics as Record<string, unknown>).summary = 'Builds platforms with Cost control.';
    const result = validateTailoredResponse(
      response(next, [change({ after: 'Builds platforms with Cost control.' })]),
      baseResume(),
      { jobDescription: 'We need cost control.' },
    );
    assert.equal(result.changes.length, 1);
  });

  it('allows a job-requested common noun at the start of a sentence', () => {
    const next = rewrittenSummary();
    (next.basics as Record<string, unknown>).summary =
      'Optimization of cloud platforms across teams.';
    const result = validateTailoredResponse(
      response(next, [
        change({ after: 'Optimization of cloud platforms across teams.' }),
      ]),
      baseResume(),
      { jobDescription: 'We need performance optimization.' },
    );
    assert.equal(result.changes.length, 1);
  });

  it('allows a job-requested common noun capitalized mid-sentence', () => {
    const next = rewrittenSummary();
    (next.basics as Record<string, unknown>).summary =
      'Delivered Optimization across cloud platforms.';
    const result = validateTailoredResponse(
      response(next, [change({ after: 'Delivered Optimization across cloud platforms.' })]),
      baseResume(),
      { jobDescription: 'We need performance optimization.' },
    );
    assert.equal(result.changes.length, 1);
  });

  it('rejects a resume that does not equal all listed changes', () => {
    const next = rewrittenSummary();
    (next.basics as Record<string, unknown>).label = 'Cloud Architect';
    assert.throws(
      () => validateTailoredResponse(response(next, [change({})]), baseResume()),
      /does not match applying every listed change/,
    );
  });
});
