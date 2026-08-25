import { describe, expect, it } from 'vitest';
import { validateResume } from './schema.js';
import type { JsonResume } from '@resume-studio/transformer';

describe('validateResume', () => {
  it('returns no issues for an empty resume', () => {
    expect(validateResume({})).toEqual([]);
  });

  it('accepts a fully valid resume', () => {
    const resume: JsonResume = {
      basics: {
        email: 'a@b.co',
        phone: '+1 (415) 555-2671',
        url: 'https://example.com',
      },
      work: [{ name: 'Acme', position: 'Dev', startDate: '2020-01-01' }],
      education: [{ institution: 'MIT' }],
      skills: [{ name: 'TS', level: 'Advanced' }],
      languages: [{ language: 'English', fluency: 'Native' }],
      volunteer: [{ organization: 'Red Cross', position: 'Volunteer' }],
      projects: [{ name: 'X', description: 'A thing' }],
    };
    expect(validateResume(resume)).toEqual([]);
  });

  // ── basics.email (CMS regex) ───────────────────────────────────────────

  it('flags an invalid basics.email', () => {
    const issues = validateResume({ basics: { email: 'not-an-email' } });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]!.path).toBe('/basics/email');
  });

  it('accepts an email matching the CMS regex', () => {
    expect(validateResume({ basics: { email: 'first.last@sub.example.co' } })).toEqual([]);
  });

  it('flags an invalid basics.email as an error', () => {
    const issues = validateResume({ basics: { email: 'not-an-email' } });
    expect(issues[0]!.severity).toBe('error');
  });

  // ── basics.phone (CMS regex, optional) ────────────────────────────────

  it('flags a phone that does not match the CMS pattern', () => {
    const issues = validateResume({ basics: { phone: '12345' } });
    expect(issues.some((i) => i.path === '/basics/phone')).toBe(true);
  });

  it('accepts common phone formats', () => {
    expect(
      validateResume({
        basics: { phone: '+1 415-555-2671' },
      }),
    ).toEqual([]);
  });

  it('allows an absent phone (optional in CMS)', () => {
    expect(validateResume({ basics: { name: 'Alice' } })).toEqual([]);
  });

  // ── select enums ───────────────────────────────────────────────────────

  it('flags a language.fluency outside the CMS select options as a warning (legacy data)', () => {
    const issues = validateResume({ languages: [{ language: 'English', fluency: 'C2' }] });
    const issue = issues.find((i) => i.path === '/languages/0/fluency');
    expect(issue).toBeTruthy();
    expect(issue!.severity).toBe('warning');
  });

  it('flags a skill.level outside the CMS select options as a warning (legacy data)', () => {
    const issues = validateResume({ skills: [{ name: 'TS', level: 'Wizard' }] });
    const issue = issues.find((i) => i.path === '/skills/0/level');
    expect(issue).toBeTruthy();
    expect(issue!.severity).toBe('warning');
  });

  it('accepts all CMS skill levels and fluency values', () => {
    const resume: JsonResume = {
      skills: [
        { name: 'A', level: 'Beginner' },
        { name: 'B', level: 'Master' },
      ],
      languages: [
        { language: 'English', fluency: 'Elementary' },
        { language: 'German', fluency: 'Native' },
      ],
    };
    expect(validateResume(resume)).toEqual([]);
  });

  // ── required fields (isRequired in CMS) ───────────────────────────────

  it('flags work missing name/position/startDate', () => {
    const issues = validateResume({ work: [{ url: 'https://x.co' }] });
    const paths = issues.map((i) => i.path);
    expect(paths).toContain('/work/0');
    expect(issues.length).toBeGreaterThan(0);
  });

  it('flags education missing institution', () => {
    const issues = validateResume({ education: [{ area: 'CS' }] });
    expect(issues.some((i) => i.path === '/education/0')).toBe(true);
  });

  it('flags skill missing name', () => {
    const issues = validateResume({ skills: [{ level: 'Expert' }] });
    expect(issues.some((i) => i.path === '/skills/0')).toBe(true);
  });

  it('flags language missing language name', () => {
    const issues = validateResume({ languages: [{ fluency: 'Native' }] });
    expect(issues.some((i) => i.path === '/languages/0')).toBe(true);
  });

  it('flags volunteer missing organization or position', () => {
    const issues = validateResume({ volunteer: [{ organization: 'Red Cross' }] });
    expect(issues.some((i) => i.path === '/volunteer/0')).toBe(true);
  });

  it('flags project missing description', () => {
    const issues = validateResume({ projects: [{ name: 'X' }] });
    expect(issues.some((i) => i.path === '/projects/0')).toBe(true);
  });

  // ── dates + URLs ───────────────────────────────────────────────────────

  it('flags malformed dates in education', () => {
    const issues = validateResume({ education: [{ institution: 'MIT', startDate: '2020/01/01' }] });
    expect(issues.some((i) => i.path === '/education/0/startDate')).toBe(true);
  });

  it('flags an invalid URL in work entries with the array path', () => {
    const issues = validateResume({
      work: [{ name: 'Acme', position: 'Dev', startDate: '2020-01-01', url: 'not-a-url' }],
    });
    expect(issues.some((i) => i.path === '/work/0/url')).toBe(true);
  });

  it('ignores empty strings (treated as blank)', () => {
    expect(
      validateResume({
        basics: { email: '', url: '' },
        work: [{ name: 'Acme', position: 'Dev', startDate: '2020-01-01', endDate: '' }],
      }),
    ).toEqual([]);
  });
});
