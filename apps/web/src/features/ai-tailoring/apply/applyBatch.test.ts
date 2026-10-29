import { describe, expect, it } from 'vitest';
import type { AnalysisEnvelope, TailoringChange } from '@resume-studio/ai';
import { createResumePayload, hashResume } from '@resume-studio/ai';
import type { JsonResume } from '@resume-studio/transformer';
import type { EditorIdentityState } from '@/state/editorStore';
import type { AppliedAiTransaction } from '../state/tailoringStore';
import { applyTailoringBatch, undoTailoringTransaction } from './applyBatch';

function resume(): JsonResume {
  return {
    basics: {
      name: 'Ada',
      label: 'Engineer',
      summary: 'Builds things.',
      email: '',
      phone: '',
      url: '',
      location: {},
      profiles: [],
    },
    work: [{ name: 'Acme', summary: 'Built a platform.', highlights: ['Shipped.'] }],
    projects: [],
    skills: [],
    education: [],
    interests: [],
    volunteer: [],
    awards: [],
    publications: [],
    certificates: [],
  };
}

function editorIds(): EditorIdentityState {
  return {
    work: [{ entryId: 'w1', highlightIds: ['h1'] }],
    projects: [],
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
    before: 'Builds things.',
    after: 'Builds resilient things.',
    evidence: [],
    ...overrides,
  };
}

function analysis(changes: TailoringChange[], snapshotHash: string): AnalysisEnvelope {
  return {
    schemaVersion: 2,
    analysisId: 'a1',
    workspaceId: 'ws1',
    documentEpoch: 'epoch1',
    baseRevision: 4,
    snapshotHash,
    jobVersion: 1,
    withheldPaths: [],
    response: { resume: resume() as unknown as Record<string, unknown>, changes, gaps: [] },
  };
}

function input(overrides: Partial<Parameters<typeof applyTailoringBatch>[0]> = {}) {
  const source = resume();
  const changes = [
    change({}),
    change({
      id: 'c2',
      group: 'g2',
      path: '/work/0/summary',
      before: 'Built a platform.',
      after: 'Built a better platform.',
    }),
  ];
  return {
    analysis: analysis(changes, createResumePayload(source).snapshotHash),
    resume: source,
    editorIds: editorIds(),
    selectedGroupIds: ['g1'],
    documentEpoch: 'epoch1',
    workspaceId: 'ws1',
    baseRevision: 4,
    snapshotHash: createResumePayload(source).snapshotHash,
    jobVersion: 1,
    jsonBufferValid: true,
    jsonBufferDirty: false,
    ...overrides,
  };
}

describe('applyTailoringBatch', () => {
  it('applies only the selected change groups', () => {
    const result = applyTailoringBatch(input());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resume.basics?.summary).toBe('Builds resilient things.');
    expect(result.resume.work?.[0]?.summary).toBe('Built a platform.');
  });

  it('stores a full undo snapshot', () => {
    const result = applyTailoringBatch(input());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const tx: AppliedAiTransaction = result.transaction;
    expect(tx.beforeResume.basics?.summary).toBe('Builds things.');
    expect(tx.afterHash).toBe(hashResume(result.resume));
  });

  it('rejects a stale snapshot hash', () => {
    const result = applyTailoringBatch(input({ snapshotHash: 'stale' }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.conflicts[0]?.message).toMatch(/evidence changed/);
  });

  it('rejects a changed job description', () => {
    const result = applyTailoringBatch(input({ jobVersion: 2 }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.conflicts[0]?.message).toMatch(/Job description changed/);
  });

  it('rejects an invalid JSON buffer', () => {
    const result = applyTailoringBatch(input({ jsonBufferDirty: true }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.conflicts[0]?.source).toBe('json-buffer');
  });

  it('rejects an empty group selection', () => {
    const result = applyTailoringBatch(input({ selectedGroupIds: [] }));

    expect(result.ok).toBe(false);
  });
});

describe('undoTailoringTransaction', () => {
  it('restores the exact before document', () => {
    const result = applyTailoringBatch(input());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const undo = undoTailoringTransaction({
      resume: result.resume,
      transaction: result.transaction,
    });

    expect(undo.ok).toBe(true);
    if (!undo.ok) return;
    expect(undo.resume).toEqual(resume());
    expect(undo.editorIds).toEqual(editorIds());
  });

  it('refuses to undo after further edits', () => {
    const result = applyTailoringBatch(input());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const edited: JsonResume = {
      ...result.resume,
      basics: { ...result.resume.basics, label: 'Senior Engineer' },
    };
    const undo = undoTailoringTransaction({ resume: edited, transaction: result.transaction });

    expect(undo.ok).toBe(false);
  });
});
