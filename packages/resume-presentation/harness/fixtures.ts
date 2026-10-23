import type { PresentationInputV1 } from '@resume-studio/studio-contracts';

type ResumeDocument = PresentationInputV1['document']['resume'];

export const populatedResume: ResumeDocument = {
  basics: {
    name: 'Ada Lovelace',
    label: 'Mathematician and programmer',
    email: 'ada@example.test',
    location: { city: 'London', countryCode: 'GB' },
    summary: 'Known for work on Charles Babbage’s Analytical Engine.',
  },
  work: [
    {
      name: 'Analytical Engine',
      position: 'Technical author',
      startDate: '1842-01-01',
      endDate: '1843-12-31',
      summary: 'Translated and expanded Menabrea’s engine notes.',
      highlights: ['Published the first algorithm intended for a machine.'],
    },
  ],
  skills: [{ name: 'Mathematics', level: 'Expert', keywords: ['Algorithms', 'Logic'] }],
};

export const emptyResume: ResumeDocument = {};

export const harnessThemeIds = ['modern-classic', 'nordic-minimal', 'monochrome-noir'] as const;
