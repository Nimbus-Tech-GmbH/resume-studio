import { describe, expect, it } from 'vitest';
import { toCms, type CmsIdMap, type ToCmsInput } from './toCms';
import type { CmsResume, JsonResume } from './types';

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

function baseIds(): CmsIdMap {
  return {
    work: ['w1'],
    education: [],
    skills: ['s1'],
    interests: [],
    volunteer: [],
    projects: [],
    certificates: ['c1'],
    languages: ['l1'],
    profiles: [],
  };
}

function makeInput(overrides: Partial<ToCmsInput> = {}): ToCmsInput {
  const original = baseJson();
  const originalCms = baseCms();
  const ids = baseIds();
  return {
    current: original,
    original,
    originalCms,
    cmsIds: ids,
    originalCmsIds: {
      work: [...ids.work],
      education: [...ids.education],
      skills: [...ids.skills],
      interests: [...ids.interests],
      volunteer: [...ids.volunteer],
      projects: [...ids.projects],
      certificates: [...ids.certificates],
      languages: [...ids.languages],
      profiles: [...ids.profiles],
    },
    resumeId: 'r1',
    ...overrides,
  };
}

describe('toCms', () => {
  it('emits nothing when nothing changed', () => {
    const plan = toCms(makeInput());
    expect(plan.ops).toEqual([]);
    expect(plan.errors).toEqual([]);
  });

  it('detects a basics scalar change', () => {
    const original = baseJson();
    const current = { ...original, basics: { ...original.basics, label: 'Senior Engineer' } };
    const plan = toCms(makeInput({ current }));
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
    const plan = toCms(makeInput({ current }));
    expect(plan.ops).toContainEqual({
      kind: 'updateResumeLocation',
      id: 'loc1',
      data: { city: 'Munich' },
    });
    expect(plan.ops.find((o) => o.kind === 'updateResumeBasicInformation')).toBeUndefined();
  });

  it('encodes skill keywords with the primary delimiter', () => {
    const original = baseJson();
    const current: JsonResume = {
      ...original,
      skills: [{ ...original.skills![0]!, keywords: ['a', 'b', 'c'] }],
    };
    const plan = toCms(makeInput({ current }));
    expect(plan.ops).toContainEqual({
      kind: 'updateResumeSkill',
      id: 's1',
      data: { keywords: 'a✌🏻b✌🏻c' },
    });
  });

  it('creates a new work highlight', () => {
    const original = baseJson();
    const current: JsonResume = {
      ...original,
      work: [{ ...original.work![0]!, highlights: ['Shipped X', 'Wrote Y', 'Fixed Z'] }],
    };
    const plan = toCms(makeInput({ current }));
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
    const plan = toCms(makeInput({ current }));
    expect(plan.ops).toContainEqual({ kind: 'deleteResumeHighlight', id: 'h2' });
  });

  it('creates a new work row via createResumeWork with resume connect', () => {
    const original = baseJson();
    const current: JsonResume = {
      ...original,
      work: [...original.work!, { name: 'NewCo', position: 'Eng', highlights: ['first'] }],
    };
    const input = makeInput({ current });
    input.cmsIds = { ...input.cmsIds, work: ['w1', null] };
    const plan = toCms(input);
    const createOp = plan.ops.find((o) => o.kind === 'createResumeWork');
    expect(createOp).toBeTruthy();
    if (createOp?.kind === 'createResumeWork') {
      expect(createOp.data.name).toBe('NewCo');
      expect(createOp.data.resume).toEqual({ connect: { id: 'r1' } });
      expect(createOp.data.highlights).toEqual({ create: [{ value: 'first' }] });
    }
  });

  it('deletes a removed work row via deleteResumeWork', () => {
    const original = baseJson();
    const current: JsonResume = { ...original, work: [] };
    const input = makeInput({ current });
    input.cmsIds = { ...input.cmsIds, work: [] };
    const plan = toCms(input);
    expect(plan.ops).toContainEqual({ kind: 'deleteResumeWork', id: 'w1' });
  });

  it('creates a new skill via createResumeSkill with resume connect', () => {
    const original = baseJson();
    const current: JsonResume = {
      ...original,
      skills: [...original.skills!, { name: 'Rust', keywords: ['x'] }],
    };
    const input = makeInput({ current });
    input.cmsIds = { ...input.cmsIds, skills: ['s1', null] };
    const plan = toCms(input);
    expect(plan.ops).toContainEqual({
      kind: 'createResumeSkill',
      data: {
        name: 'Rust',
        level: undefined,
        keywords: 'x',
        resume: { connect: { id: 'r1' } },
      },
    });
  });

  it('deletes a removed skill', () => {
    const original = baseJson();
    const current: JsonResume = { ...original, skills: [] };
    const input = makeInput({ current });
    input.cmsIds = { ...input.cmsIds, skills: [] };
    const plan = toCms(input);
    expect(plan.ops).toContainEqual({ kind: 'deleteResumeSkill', id: 's1' });
  });

  it('deletes a certificate via updateResume disconnect', () => {
    const original = baseJson();
    const current: JsonResume = { ...original, certificates: [] };
    const input = makeInput({ current });
    input.cmsIds = { ...input.cmsIds, certificates: [] };
    const plan = toCms(input);
    expect(plan.ops).toContainEqual({
      kind: 'updateResume',
      id: 'r1',
      data: { certificates: { disconnect: [{ id: 'c1' }] } },
    });
  });

  it('creates a certificate via updateResume nested create', () => {
    const original = baseJson();
    const current: JsonResume = {
      ...original,
      certificates: [
        ...original.certificates!,
        { name: 'K8s CKA', url: 'https://k', summary: 's' },
      ],
    };
    const input = makeInput({ current });
    input.cmsIds = { ...input.cmsIds, certificates: ['c1', null] };
    const plan = toCms(input);
    const op = plan.ops.find((o) => o.kind === 'updateResume');
    expect(op).toBeTruthy();
    if (op?.kind === 'updateResume') {
      expect(op.data).toEqual({
        certificates: {
          create: [{ title: 'K8s CKA', link: 'https://k', description: 's' }],
        },
      });
    }
  });

  it('reorder does NOT emit ops (no order field in CMS)', () => {
    // Move work[0] to end (only 1 item, so add a second and reorder).
    const original: JsonResume = {
      ...baseJson(),
      skills: [
        { name: 'TS', level: 'Advanced', keywords: ['a', 'b'] },
        { name: 'Go', level: 'Junior' },
      ],
    };
    const originalCms: CmsResume = {
      ...baseCms(),
      skills: [
        { id: 's1', name: 'TS', level: 'Advanced', keywords: 'a✌🏻b' },
        { id: 's2', name: 'Go', level: 'Junior', keywords: '' },
      ],
    };
    const ids: CmsIdMap = { ...baseIds(), skills: ['s2', 's1'] };
    const current: JsonResume = { ...original, skills: [original.skills![1]!, original.skills![0]!] };
    const plan = toCms({
      current,
      original,
      originalCms,
      cmsIds: ids,
      originalCmsIds: { ...baseIds(), skills: ['s1', 's2'] },
      resumeId: 'r1',
    });
    // Zero ops emitted: order is UI-only.
    expect(plan.ops).toEqual([]);
  });

  it('renames JSON Resume certificate fields to CMS ones', () => {
    const original = baseJson();
    const current: JsonResume = {
      ...original,
      certificates: [
        { ...original.certificates![0]!, name: 'AWS SAA-C03', url: 'https://b' },
      ],
    };
    const plan = toCms(makeInput({ current }));
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
    const plan = toCms(makeInput({ current }));
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
    const plan = toCms(makeInput({ current }));
    expect(plan.errors).toEqual([
      { path: 'work[0].startDate', message: 'Invalid date: nope' },
    ]);
    const workOp = plan.ops.find((op) => op.kind === 'updateResumeWork');
    if (workOp && workOp.kind === 'updateResumeWork') {
      expect(workOp.data.startDate).toBeUndefined();
    }
  });
});
