import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyTailoringSelection,
  groupChanges,
  undoApplyTransaction,
  type ApplyTransaction,
} from './apply';
import { createResumePayload, restoreWithheldFields } from './resumePayload';
import { hashResume } from './resumePayload';
import type { TailoringChange } from './types';

function source(): Record<string, unknown> {
  return {
    basics: { summary: 'Builds platforms.', email: 'ada@example.com', phone: '123' },
    work: [{ name: 'Acme', summary: 'Built a platform.', highlights: ['Shipped.', 'Mentored.'] }],
  };
}

function change(overrides: Partial<TailoringChange>): TailoringChange {
  return {
    id: 'c1',
    group: 'g1',
    type: 'rewrite-summary',
    section: 'basics',
    entity: 'Summary',
    summary: 'Match the role.',
    path: '/basics/summary',
    op: 'rewrite',
    before: 'Builds platforms.',
    after: 'Builds resilient platforms.',
    evidence: [],
    ...overrides,
  };
}

describe('applyTailoringSelection', () => {
  it('applies only accepted groups and leaves rejected groups untouched', () => {
    const original = source();
    const result = applyTailoringSelection(original, [
      change({}),
      change({
        id: 'c2',
        group: 'g2',
        type: 'rewrite-work-summary',
        section: 'work',
        entity: 'Acme',
        path: '/work/0/summary',
        before: 'Built a platform.',
        after: 'Built a reliable platform.',
      }),
    ], ['g1']);

    const basics = result.resume.basics as Record<string, unknown>;
    const work = (result.resume.work as Array<Record<string, unknown>>)[0]!;
    assert.equal(basics.summary, 'Builds resilient platforms.');
    assert.equal(work.summary, 'Built a platform.');
    assert.deepEqual(result.appliedGroupIds, ['g1']);
    assert.deepEqual(result.rejectedChangeIds, ['c2']);
  });

  it('does not mutate the source document', () => {
    const original = source();
    applyTailoringSelection(original, [change({})], ['g1']);
    assert.equal((original.basics as Record<string, unknown>).summary, 'Builds platforms.');
  });

  it('applies highlight deletes from the end of the array', () => {
    const original = source();
    const result = applyTailoringSelection(original, [
      change({
        id: 'c2',
        type: 'delete-work-highlight',
        section: 'work',
        entity: 'Acme',
        path: '/work/0/highlights/0',
        op: 'delete',
        before: 'Shipped.',
        after: null,
      }),
      change({
        id: 'c3',
        type: 'delete-work-highlight',
        section: 'work',
        entity: 'Acme',
        path: '/work/0/highlights/1',
        op: 'delete',
        before: 'Mentored.',
        after: null,
      }),
    ], ['g1']);

    assert.deepEqual((result.resume.work as Array<Record<string, unknown>>)[0]!.highlights, []);
  });

  it('fails when the source value changed after analysis', () => {
    const original = source();
    (original.basics as Record<string, unknown>).summary = 'Different.';
    assert.throws(() => applyTailoringSelection(original, [change({})], ['g1']), /changed after analysis/);
  });
});

describe('groupChanges', () => {
  it('keeps related changes together', () => {
    const groups = groupChanges([
      change({}),
      change({ id: 'c2', type: 'rewrite-work-highlight', section: 'work', path: '/work/0/highlights/0', before: 'Shipped.', after: 'Shipped the API.' }),
      change({ id: 'c3', group: 'g2', type: 'rewrite-work-summary', section: 'work', path: '/work/0/summary', before: 'Built a platform.', after: 'Built a reliable platform.' }),
    ]);
    assert.equal(groups.length, 2);
    assert.equal(groups[0]!.changes.length, 2);
  });
});

describe('undoApplyTransaction', () => {
  it('restores the exact pre-apply document when nothing else changed', () => {
    const before = source();
    const after = applyTailoringSelection(before, [change({})], ['g1']).resume;
    const transaction: ApplyTransaction = {
      id: 'tx',
      before,
      afterHash: hashResume(after),
      appliedGroupIds: ['g1'],
    };
    const undo = undoApplyTransaction(after, transaction, hashResume);
    assert.equal(undo.ok, true);
    if (!undo.ok) return;
    assert.deepEqual(undo.resume, before);
  });

  it('refuses to undo after further edits', () => {
    const before = source();
    const after = applyTailoringSelection(before, [change({})], ['g1']).resume;
    const edited = structuredClone(after);
    (edited.basics as Record<string, unknown>).summary = 'Further edit.';
    const undo = undoApplyTransaction(
      edited,
      { id: 'tx', before, afterHash: hashResume(after), appliedGroupIds: ['g1'] },
      hashResume,
    );
    assert.equal(undo.ok, false);
  });
});

describe('resume payload', () => {
  it('withholds contact fields and restores them untouched', () => {
    const original = source();
    const payload = createResumePayload(original);
    const modelBasics = payload.resume.basics as Record<string, unknown>;
    assert.equal(modelBasics.email, undefined);
    assert.equal(modelBasics.phone, undefined);

    const restored = restoreWithheldFields(original, payload.resume, payload.withheldPaths);
    assert.equal((restored.basics as Record<string, unknown>).email, 'ada@example.com');
    assert.equal((restored.basics as Record<string, unknown>).phone, '123');
  });
});
