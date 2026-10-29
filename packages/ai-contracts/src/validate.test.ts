import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TailoringChange, TailoredResumeResponse } from './tailoring.js';
import {
  TailoringValidationError,
  applyTailoringChanges,
  validateTailoredResponse,
} from './validate.js';

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
    path: '/basics/summary',
    op: 'rewrite',
    before: 'Builds platforms.',
    after: 'Builds resilient platforms.',
    reason: 'Match the platform requirement.',
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
    const parsed = response(rewrittenSummary(), [change({})]);
    const result = validateTailoredResponse(parsed, baseResume());
    assert.equal(result.changes.length, 1);
  });

  it('rejects extra top-level keys', () => {
    const parsed = { ...response(rewrittenSummary(), [change({})]), extra: true };
    assert.throws(
      () => validateTailoredResponse(parsed, baseResume()),
      (error: unknown) =>
        error instanceof TailoringValidationError && /exactly resume, changes, gaps/.test(error.message),
    );
  });

  it('rejects a missing top-level key', () => {
    const parsed = { resume: rewrittenSummary(), changes: [] };
    assert.throws(() => validateTailoredResponse(parsed, baseResume()), TailoringValidationError);
  });

  it('rejects an immutable work field change', () => {
    const next = rewrittenSummary();
    (next.work as Array<Record<string, unknown>>)[0]!.position = 'Staff Engineer';
    assert.throws(
      () =>
        validateTailoredResponse(
          response(next, [
            change({}),
            change({
              id: 'c2',
              path: '/work/0/position',
              before: 'Engineer',
              after: 'Staff Engineer',
            }),
          ]),
          baseResume(),
        ),
      /must not change/,
    );
  });

  it('rejects a new skill keyword', () => {
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
            change({ op: 'reorder', path: '/skills/0/keywords', before: ['strict', 'react'], after: ['strict', 'react', 'graphql'] }),
          ]),
          baseResume(),
        ),
      /only change order/,
    );
  });

  it('allows reordering skills', () => {
    const next = rewrittenSummary();
    next.skills = [
      { name: 'TypeScript', keywords: ['react', 'strict'], level: 'Advanced' },
    ];
    const reorder = change({
      op: 'reorder',
      path: '/skills/0/keywords',
      before: ['strict', 'react'],
      after: ['react', 'strict'],
    });
    const result = validateTailoredResponse(
      response(next, [change({}), change({ ...reorder, id: 'c2' })]),
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
              op: 'narrow',
              path: '/basics/label',
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
          op: 'narrow',
          path: '/basics/label',
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
          op: 'narrow',
          path: '/basics/label',
          reason: 'Match the headline style.',
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
              op: 'delete',
              path: '/work/0/highlights/0',
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
          op: 'delete',
          path: '/work/0/highlights/1',
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
          response(next, [
            change({ after: 'Reduced latency by 40%.' }),
          ]),
          baseResume(),
        ),
      /unsupported number/,
    );
  });

  it('allows a job-requested common noun capitalized mid-sentence', () => {
    const next = rewrittenSummary();
    (next.basics as Record<string, unknown>).summary =
      'Delivered Optimization across cloud platforms.';
    const result = validateTailoredResponse(
      response(next, [
        change({ after: 'Delivered Optimization across cloud platforms.' }),
      ]),
      baseResume(),
    );
    assert.equal(result.changes.length, 1);
  });

  it('rejects a change whose after-value does not match the resume', () => {
    assert.throws(
      () =>
        validateTailoredResponse(
          response(rewrittenSummary(), [change({ after: 'Different text.' })]),
          baseResume(),
        ),
      /after-value does not match/,
    );
  });

  it('rejects a resume difference with no change entry', () => {
    assert.throws(
      () => validateTailoredResponse(response(rewrittenSummary(), []), baseResume()),
      /do not fully describe/,
    );
  });

  it('rejects a change to a withheld contact field', () => {
    const next = rewrittenSummary();
    (next.basics as Record<string, unknown>).email = 'other@example.com';
    assert.throws(
      () =>
        validateTailoredResponse(
          response(next, [
            change({}),
            change({
              id: 'c2',
              path: '/basics/email',
              before: 'ada@example.com',
              after: 'other@example.com',
            }),
          ]),
          baseResume(),
        ),
      /must not change/,
    );
  });

  it('accepts creating a missing basics summary', () => {
    const source = baseResume();
    delete (source.basics as Record<string, unknown>).summary;
    const next = structuredClone(source);
    (next.basics as Record<string, unknown>).summary = 'Built a platform.';

    const result = validateTailoredResponse(
      response(next, [
        change({ before: null, after: 'Built a platform.' }),
      ]),
      source,
    );

    assert.equal(result.changes.length, 1);
    const applied = applyTailoringChanges(source, result);
    assert.equal((applied.basics as Record<string, unknown>).summary, 'Built a platform.');
  });

  it('rejects extra basics keys other than a missing summary', () => {
    const next = rewrittenSummary();
    (next.basics as Record<string, unknown>).pronouns = 'she/her';
    assert.throws(
      () =>
        validateTailoredResponse(
          response(next, [
            change({}),
            change({
              id: 'c2',
              path: '/basics/pronouns',
              before: null,
              after: 'she/her',
            }),
          ]),
          baseResume(),
        ),
      /must contain exactly/,
    );
  });

  it('rejects a reorder that changes array contents', () => {
    const next = rewrittenSummary();
    (next.work as Array<Record<string, unknown>>)[0]!.highlights = [
      'Shipped the API to 3 teams.',
      'Led migration.',
    ];
    assert.throws(
      () =>
        validateTailoredResponse(
          response(next, [
            change({}),
            change({
              id: 'c2',
              op: 'reorder',
              path: '/work/0/highlights',
              before: ['Shipped the API to 3 teams.', 'Mentored 2 engineers.'],
              after: ['Shipped the API to 3 teams.', 'Led migration.'],
            }),
          ]),
          baseResume(),
        ),
      /changes its contents/,
    );
  });

  it('rejects emptying the label', () => {
    const next = rewrittenSummary();
    (next.basics as Record<string, unknown>).label = '';
    assert.throws(
      () =>
        validateTailoredResponse(
          response(next, [
            change({}),
            change({
              id: 'c2',
              op: 'narrow',
              path: '/basics/label',
              before: 'Cloud and Data Architect',
              after: '',
            }),
          ]),
          baseResume(),
        ),
      /must not be emptied/,
    );
  });

  it('rejects a gap that cites a missing searched path', () => {
    const parsed = {
      ...response(rewrittenSummary(), [change({})]),
      gaps: [
        {
          kind: 'missing_requirement' as const,
          requirement: 'Kubernetes',
          detail: 'Not present.',
          searched: ['/work/9/highlights'],
        },
      ],
    };
    assert.throws(
      () => validateTailoredResponse(parsed, baseResume()),
      /missing searched path/,
    );
  });

  it('rejects reorder combined with nested edits', () => {
    const next = rewrittenSummary();
    (next.basics as Record<string, unknown>).summary = 'Builds resilient platforms.';
    next.skills = [
      { name: 'TypeScript', keywords: ['react', 'strict'], level: 'Advanced' },
    ];
    assert.throws(
      () =>
        validateTailoredResponse(
          response(next, [
            change({}),
            change({
              id: 'c2',
              op: 'reorder',
              path: '/skills',
              before: baseResume().skills,
              after: next.skills,
            }),
            change({
              id: 'c3',
              op: 'reorder',
              path: '/skills/0/keywords',
              before: ['strict', 'react'],
              after: ['react', 'strict'],
            }),
          ]),
          baseResume(),
        ),
      /mixes reorder and nested edits/,
    );
  });
});

describe('applyTailoringChanges', () => {
  function groupedResponse() {
    const next = rewrittenSummary();
    (next.work as Array<Record<string, unknown>>)[0]!.summary = 'Built a better platform.';
    return response(next, [
      change({}),
      change({
        id: 'c2',
        group: 'g2',
        path: '/work/0/summary',
        before: 'Built a platform.',
        after: 'Built a better platform.',
      }),
    ]);
  }

  it('applies only the selected group to the editor document', () => {
    const source = baseResume();
    const applied = applyTailoringChanges(source, groupedResponse(), ['g2']);
    const basics = applied.basics as Record<string, unknown>;
    const work = (applied.work as Array<Record<string, unknown>>)[0]!;
    assert.equal(basics.summary, 'Builds platforms.');
    assert.equal(work.summary, 'Built a better platform.');
  });

  it('never mutates the source document', () => {
    const source = baseResume();
    applyTailoringChanges(source, groupedResponse());
    assert.equal(
      (source.basics as Record<string, unknown>).summary,
      'Builds platforms.',
    );
  });

  it('applies all groups when none are selected', () => {
    const applied = applyTailoringChanges(baseResume(), groupedResponse());
    assert.deepEqual(applied, groupedResponse().resume);
  });
});
