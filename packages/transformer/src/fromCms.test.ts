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
