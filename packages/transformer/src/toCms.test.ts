import { describe, expect, it } from 'vitest';
import { toCms } from './toCms.js';
import type { CmsResume, JsonResume } from './types.js';

function baseCms(): CmsResume {
  return {
    id: 'r1',
    title: 'Alice - Engineer',
    basicInformation: {
      id: 'bi1',
      name: 'Alice',
      email: 'a@example.com',
      label: 'Engineer',
      location: { id: 'loc1', city: 'Berlin', countryCode: 'DE' },
    },
    skills: [{ id: 's1', name: 'TS', level: 'Advanced', keywords: 'a✌🏻b' }],
    work: [
      {
        id: 'w1',
        name: 'Acme',
        position: 'Dev',
        startDate: '2020-01-01T00:00:00.000Z',
        highlights: [
          { id: 'h1', value: 'Shipped X' },
          { id: 'h2', value: 'Wrote Y' },
        ],
      },
    ],
    certificates: [{ id: 'c1', title: 'AWS SAA', link: 'https://a', description: 'note' }],
    resumeLanguages: [{ id: 'l1', language: 'English', fluency: 'Native' }],
  };
}

function baseJson(): JsonResume {
  return {
    basics: {
      name: 'Alice',
      email: 'a@example.com',
      label: 'Engineer',
      location: { city: 'Berlin', countryCode: 'DE' },
    },
    skills: [{ name: 'TS', level: 'Advanced', keywords: ['a', 'b'] }],
    work: [
      {
        name: 'Acme',
        position: 'Dev',
        startDate: '2020-01-01',
        highlights: ['Shipped X', 'Wrote Y'],
      },
    ],
    certificates: [{ name: 'AWS SAA', url: 'https://a', summary: 'note' }],
    languages: [{ language: 'English', fluency: 'Native' }],
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
    expect(plan.ops).toContainEqual({
      kind: 'updateResumeBasicInformation',
      id: 'bi1',
      data: { label: 'Senior Engineer' },
    });
  });

  it('routes location edits to updateResumeLocation', () => {
    const original = baseJson();
    const current: JsonResume = {
      ...original,
      basics: {
        ...original.basics,
        location: { ...original.basics!.location, city: 'Munich' },
      },
    };
    const plan = toCms({ current, original, originalCms: baseCms() });
    expect(plan.ops).toContainEqual({
      kind: 'updateResumeLocation',
      id: 'loc1',
      data: { city: 'Munich' },
    });
    // basics op should NOT include location fields
    const biOp = plan.ops.find((o) => o.kind === 'updateResumeBasicInformation');
    expect(biOp).toBeUndefined();
  });

  it('encodes skill keywords with the primary delimiter', () => {
    const original = baseJson();
    const current: JsonResume = {
      ...original,
      skills: [{ ...original.skills![0]!, keywords: ['a', 'b', 'c'] }],
    };
    const plan = toCms({ current, original, originalCms: baseCms() });
    expect(plan.ops).toContainEqual({
      kind: 'updateResumeSkill',
      id: 's1',
      data: { keywords: 'a✌🏻b✌🏻c' },
    });
  });

  it('creates a new work highlight (no order field emitted)', () => {
    const original = baseJson();
    const current: JsonResume = {
      ...original,
      work: [{ ...original.work![0]!, highlights: ['Shipped X', 'Wrote Y', 'Fixed Z'] }],
    };
    const plan = toCms({ current, original, originalCms: baseCms() });
    expect(plan.ops).toContainEqual({
      kind: 'createResumeHighlight',
      data: { value: 'Fixed Z', work: { connect: { id: 'w1' } } },
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
      data: { value: 'Shipped X (v2)' },
    });
  });

  it('renames JSON Resume certificate fields to CMS ones', () => {
    const original = baseJson();
    const current: JsonResume = {
      ...original,
      certificates: [
        { ...original.certificates![0]!, name: 'AWS SAA-C03', url: 'https://b' },
      ],
    };
    const plan = toCms({ current, original, originalCms: baseCms() });
    expect(plan.ops).toContainEqual({
      kind: 'updateCertification',
      id: 'c1',
      data: { title: 'AWS SAA-C03', link: 'https://b' },
    });
  });

  it('updates resume languages', () => {
    const original = baseJson();
    const current: JsonResume = {
      ...original,
      languages: [{ language: 'English', fluency: 'C2' }],
    };
    const plan = toCms({ current, original, originalCms: baseCms() });
    expect(plan.ops).toContainEqual({
      kind: 'updateResumeLanguage',
      id: 'l1',
      data: { fluency: 'C2' },
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
    const workOp = plan.ops.find((op) => op.kind === 'updateResumeWork');
    if (workOp && workOp.kind === 'updateResumeWork') {
      expect(workOp.data.startDate).toBeUndefined();
    }
  });
});
