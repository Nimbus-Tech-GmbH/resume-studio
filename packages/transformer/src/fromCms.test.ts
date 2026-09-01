import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { fromCms } from './fromCms';
import type { CmsResume } from './types';

const nonEmptyString = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => s.trim().length > 0);

const idString = fc.uuid();

const isoDate = fc
  .integer({ min: 946684800000, max: 1924992000000 })
  .map((ms) => new Date(ms).toISOString());

const cmsSkillArb = fc.record({
  id: idString,
  name: nonEmptyString,
  level: nonEmptyString,
  keywords: fc.array(nonEmptyString, { maxLength: 5 }).map((xs) => xs.join('✌🏻')),
});

const cmsWorkArb = fc.record({
  id: idString,
  name: nonEmptyString,
  position: nonEmptyString,
  startDate: isoDate,
  endDate: isoDate,
  summary: nonEmptyString,
  highlights: fc.array(
    fc.record({ id: idString, value: nonEmptyString }),
    { maxLength: 4 },
  ),
});

const cmsResumeArb: fc.Arbitrary<CmsResume> = fc.record({
  id: idString,
  title: nonEmptyString,
  updatedAt: isoDate,
  basicInformation: fc.record({
    id: idString,
    name: nonEmptyString,
    email: fc.emailAddress(),
    label: nonEmptyString,
    location: fc.record({ id: idString, city: nonEmptyString }),
  }),
  skills: fc.array(cmsSkillArb, { maxLength: 4 }),
  work: fc.array(cmsWorkArb, { maxLength: 3 }),
});

describe('fromCms property tests', () => {
  it('preserves list order (no sort by CMS order field)', () => {
    fc.assert(
      fc.property(cmsResumeArb, (cms) => {
        const json = fromCms(cms);
        const inputNames = (cms.skills ?? []).map((s) => s.name);
        const outputNames = (json.skills ?? []).map((s) => s.name);
        expect(outputNames).toEqual(inputNames);
      }),
      { numRuns: 40 },
    );
  });

  it('decodes skill keywords into arrays', () => {
    fc.assert(
      fc.property(cmsResumeArb, (cms) => {
        const json = fromCms(cms);
        for (const skill of json.skills ?? []) {
          expect(Array.isArray(skill.keywords)).toBe(true);
        }
      }),
      { numRuns: 40 },
    );
  });

  it('flattens location relation into basics.location scalars', () => {
    fc.assert(
      fc.property(cmsResumeArb, (cms) => {
        const json = fromCms(cms);
        expect(json.basics?.location?.city).toBe(cms.basicInformation?.location?.city);
      }),
      { numRuns: 30 },
    );
  });
});

describe('fromCms deterministic tests', () => {
  it('maps profiles from CMS to JSON Resume', () => {
    const cms: CmsResume = {
      id: 'r1',
      basicInformation: {
        id: 'bi1',
        profiles: [
          { id: 'p1', network: 'LinkedIn', username: 'alice', url: 'https://linkedin.com/in/alice' },
          { id: 'p2', network: 'GitHub', username: 'alicegh', url: 'https://github.com/alice' },
        ],
      },
    };
    const json = fromCms(cms);
    expect(json.basics?.profiles).toEqual([
      { network: 'LinkedIn', username: 'alice', url: 'https://linkedin.com/in/alice' },
      { network: 'GitHub', username: 'alicegh', url: 'https://github.com/alice' },
    ]);
  });

  it('maps image src to basics.image string', () => {
    const cms: CmsResume = {
      id: 'r1',
      basicInformation: {
        id: 'bi1',
        image: { id: 'img1', src: 'https://example.com/photo.jpg' },
      },
    };
    const json = fromCms(cms);
    expect(json.basics?.image).toBe('https://example.com/photo.jpg');
  });

  it('returns undefined image when CMS image is null', () => {
    const cms: CmsResume = {
      id: 'r1',
      basicInformation: { id: 'bi1', image: null },
    };
    const json = fromCms(cms);
    expect(json.basics?.image).toBeUndefined();
  });

  it('maps work highlights from CmsHighlight[] to string[]', () => {
    const cms: CmsResume = {
      id: 'r1',
      work: [
        {
          id: 'w1',
          name: 'Acme',
          position: 'Dev',
          highlights: [
            { id: 'h1', value: 'Shipped feature' },
            { id: 'h2', value: '' },
            { id: 'h3', value: 'Reduced latency' },
          ],
        },
      ],
    };
    const json = fromCms(cms);
    expect(json.work![0]!.highlights).toEqual(['Shipped feature', 'Reduced latency']);
  });

  it('maps certificates with field renames', () => {
    const cms: CmsResume = {
      id: 'r1',
      certificates: [{ id: 'c1', title: 'AWS SAA', description: 'Cloud cert', link: 'https://aws' }],
    };
    const json = fromCms(cms);
    expect(json.certificates).toEqual([{ name: 'AWS SAA', summary: 'Cloud cert', url: 'https://aws' }]);
  });

  it('maps resumeLanguages to languages', () => {
    const cms: CmsResume = {
      id: 'r1',
      resumeLanguages: [
        { id: 'l1', language: 'English', fluency: 'Native' },
        { id: 'l2', language: 'German', fluency: 'B2' },
      ],
    };
    const json = fromCms(cms);
    expect(json.languages).toEqual([
      { language: 'English', fluency: 'Native' },
      { language: 'German', fluency: 'B2' },
    ]);
  });

  it('maps meta fields', () => {
    const cms: CmsResume = {
      id: 'r1',
      title: 'My Resume',
      updatedAt: '2024-06-15T10:00:00.000Z',
      language: { id: 'lang1', label: 'English', value: 'en' },
    };
    const json = fromCms(cms);
    expect(json.meta).toEqual({
      title: 'My Resume',
      language: 'en',
      lastModified: '2024-06-15T10:00:00.000Z',
    });
  });

  it('returns undefined basics when basicInformation is absent', () => {
    const cms: CmsResume = { id: 'r1' };
    const json = fromCms(cms);
    expect(json.basics).toBeUndefined();
  });

  it('returns empty arrays for missing sections', () => {
    const cms: CmsResume = { id: 'r1' };
    const json = fromCms(cms);
    expect(json.work).toEqual([]);
    expect(json.skills).toEqual([]);
    expect(json.education).toEqual([]);
  });
});
