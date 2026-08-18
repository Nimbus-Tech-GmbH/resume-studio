import { describe, expect, it } from 'vitest';
import { toCms } from './toCms.js';
import type { CmsResume, JsonResume } from './types.js';

function baseCms(): CmsResume {
  return {
    id: 'r1',
    basicInformation: {
      id: 'bi1',
      name: 'Alice',
      email: 'a@example.com',
      label: 'Engineer',
    },
    skills: [{ id: 's1', name: 'TS', level: 'Advanced', keywords: 'a✌🏻b' }],
    work: [
      {
        id: 'w1',
        name: 'Acme',
        position: 'Dev',
        startDate: '2020-01-01T00:00:00.000Z',
        highlights: [
          { id: 'h1', value: 'Shipped X', order: 0 },
          { id: 'h2', value: 'Wrote Y', order: 1 },
        ],
      },
    ],
  };
}

function baseJson(): JsonResume {
  return {
    basics: { name: 'Alice', email: 'a@example.com', label: 'Engineer' },
    skills: [{ name: 'TS', level: 'Advanced', keywords: ['a', 'b'] }],
    work: [
      {
        name: 'Acme',
        position: 'Dev',
        startDate: '2020-01-01',
        highlights: ['Shipped X', 'Wrote Y'],
      },
    ],
  };
}

describe('toCms', () => {
  it('emits nothing when nothing changed', () => {
    const original = baseJson();
    const plan = toCms({ current: original, original, originalCms: baseCms() });
    expect(plan.ops).toEqual([]);
    expect(plan.errors).toEqual([]);
  });

  it('detects a basics scalar change', () => {
    const original = baseJson();
    const current = { ...original, basics: { ...original.basics, label: 'Senior Engineer' } };
    const plan = toCms({ current, original, originalCms: baseCms() });
    expect(plan.ops).toEqual([
      { kind: 'updateResumeBasicInformation', id: 'bi1', data: { label: 'Senior Engineer' } },
    ]);
  });

  it('detects skill keyword changes and encodes with the primary delimiter', () => {
    const original = baseJson();
    const current: JsonResume = {
      ...original,
      skills: [{ ...original.skills![0]!, keywords: ['a', 'b', 'c'] }],
    };
    const plan = toCms({ current, original, originalCms: baseCms() });
    expect(plan.ops).toEqual([
      { kind: 'updateResumeSkill', id: 's1', data: { keywords: 'a✌🏻b✌🏻c' } },
    ]);
  });

  it('creates a new work highlight when appended', () => {
    const original = baseJson();
    const current: JsonResume = {
      ...original,
      work: [{ ...original.work![0]!, highlights: ['Shipped X', 'Wrote Y', 'Fixed Z'] }],
    };
    const plan = toCms({ current, original, originalCms: baseCms() });
    expect(plan.ops).toContainEqual({
      kind: 'createResumeHighlight',
      data: { value: 'Fixed Z', order: 2, work: { connect: { id: 'w1' } } },
    });
  });

  it('deletes a removed work highlight', () => {
    const original = baseJson();
    const current: JsonResume = {
      ...original,
      work: [{ ...original.work![0]!, highlights: ['Shipped X'] }],
    };
    const plan = toCms({ current, original, originalCms: baseCms() });
    expect(plan.ops).toContainEqual({ kind: 'deleteResumeHighlight', id: 'h2' });
  });

  it('updates an edited work highlight', () => {
    const original = baseJson();
    const current: JsonResume = {
      ...original,
      work: [{ ...original.work![0]!, highlights: ['Shipped X (v2)', 'Wrote Y'] }],
    };
    const plan = toCms({ current, original, originalCms: baseCms() });
    expect(plan.ops).toContainEqual({
      kind: 'updateResumeHighlight',
      id: 'h1',
      data: { value: 'Shipped X (v2)', order: 0 },
    });
  });

  it('reports invalid date + does not emit a bad ISO', () => {
    const original = baseJson();
    const current: JsonResume = {
      ...original,
      work: [{ ...original.work![0]!, startDate: 'nope' }],
    };
    const plan = toCms({ current, original, originalCms: baseCms() });
    expect(plan.errors).toEqual([
      { path: 'work[0].startDate', message: 'Invalid date: nope' },
    ]);
    // The work update should not contain a startDate key.
    const workOp = plan.ops.find((op) => op.kind === 'updateResumeWork');
    if (workOp && workOp.kind === 'updateResumeWork') {
      expect(workOp.data.startDate).toBeUndefined();
    }
  });
});
