import { describe, expect, it } from 'vitest';
import { canListCmsResumes, canLoadCmsResume } from './queryAccess';

describe('CMS query access', () => {
  it('disables all resume GraphQL reads for guests', () => {
    expect(canListCmsResumes(false)).toBe(false);
    expect(canLoadCmsResume('resume-1', false)).toBe(false);
  });

  it('requires both authentication and a resume id for detail reads', () => {
    expect(canListCmsResumes(true)).toBe(true);
    expect(canLoadCmsResume(null, true)).toBe(false);
    expect(canLoadCmsResume('', true)).toBe(false);
    expect(canLoadCmsResume('resume-1', true)).toBe(true);
  });
});
