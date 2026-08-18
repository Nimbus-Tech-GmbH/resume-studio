/**
 * CMS → JSON Resume.
 *
 * Milestone 1 will port the full converter from
 * `nimbus-tech/scripts/exportResumes/convert.ts`.
 * Milestone 0 wires the shape so downstream packages can typecheck today.
 */

import { decodeDate } from './dateCodec.js';
import { decodeList } from './listCodec.js';
import type {
  CmsResume,
  JsonResume,
  JsonResumeEducation,
  JsonResumeInterest,
  JsonResumeProject,
  JsonResumeSkill,
  JsonResumeVolunteer,
  JsonResumeWork,
} from './types.js';

export function fromCms(cms: CmsResume): JsonResume {
  const bi = cms.basicInformation;
  return {
    basics: bi
      ? {
          name: bi.name,
          label: bi.label,
          image: bi.image?.url,
          email: bi.email,
          phone: bi.phone,
          url: bi.url,
          summary: bi.summary,
          location: {
            address: bi.address,
            postalCode: bi.postalCode,
            city: bi.city,
            countryCode: bi.countryCode,
            region: bi.region,
          },
          profiles: bi.profiles?.map((p) => ({
            network: p.network,
            username: p.username,
            url: p.url,
          })),
        }
      : undefined,
    work: sortByOrder(cms.work).map(mapWork),
    education: sortByOrder(cms.education).map(mapEducation),
    skills: sortByOrder(cms.skills).map(mapSkill),
    interests: sortByOrder(cms.interests).map(mapInterest),
    volunteer: sortByOrder(cms.volunteer).map(mapVolunteer),
    projects: sortByOrder(cms.projects).map(mapProject),
    certificates: sortByOrder(cms.certifications).map((c) => ({
      name: c.title,
      date: decodeDate(c.date),
      issuer: c.issuer,
      url: c.link,
      summary: c.description,
    })),
    languages: sortByOrder(cms.languages).map((l) => ({
      language: l.language,
      fluency: l.fluency,
    })),
    meta: {
      language: cms.language,
      lastModified: cms.updatedAt,
    },
  };
}

function sortByOrder<T extends { order?: number }>(list: readonly T[] | undefined): T[] {
  if (!list) return [];
  return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function mapWork(w: NonNullable<CmsResume['work']>[number]): JsonResumeWork {
  return {
    name: w.name,
    position: w.position,
    url: w.url,
    startDate: decodeDate(w.startDate),
    endDate: decodeDate(w.endDate),
    summary: w.summary,
    highlights: sortByOrder(w.highlights)
      .map((h) => h.value ?? '')
      .filter(Boolean),
  };
}

function mapEducation(e: NonNullable<CmsResume['education']>[number]): JsonResumeEducation {
  return {
    institution: e.institution,
    url: e.url,
    area: e.area,
    studyType: e.studyType,
    startDate: decodeDate(e.startDate),
    endDate: decodeDate(e.endDate),
    score: e.score,
    courses: decodeList(e.courses),
  };
}

function mapSkill(s: NonNullable<CmsResume['skills']>[number]): JsonResumeSkill {
  return { name: s.name, level: s.level, keywords: decodeList(s.keywords) };
}

function mapInterest(i: NonNullable<CmsResume['interests']>[number]): JsonResumeInterest {
  return { name: i.name, keywords: decodeList(i.keywords) };
}

function mapVolunteer(v: NonNullable<CmsResume['volunteer']>[number]): JsonResumeVolunteer {
  return {
    organization: v.organization,
    position: v.position,
    url: v.url,
    startDate: decodeDate(v.startDate),
    endDate: decodeDate(v.endDate),
    summary: v.summary,
    highlights: decodeList(v.highlights),
  };
}

function mapProject(p: NonNullable<CmsResume['projects']>[number]): JsonResumeProject {
  return {
    name: p.name,
    description: p.description,
    highlights: decodeList(p.highlights),
    keywords: decodeList(p.keywords),
    startDate: decodeDate(p.startDate),
    endDate: decodeDate(p.endDate),
    url: p.url,
  };
}
