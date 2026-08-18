/**
 * CMS → JSON Resume.
 *
 * The Keystone schema does not expose an `order` field on any resume relation,
 * so we preserve the array order returned by GraphQL. If a stable ordering is
 * ever needed, add `order: Int` to the relevant Keystone lists (PLAN §10.2)
 * and re-introduce a sort here.
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
  const loc = bi?.location;
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
          location: loc
            ? {
                address: loc.address,
                postalCode: loc.postalCode,
                city: loc.city,
                countryCode: loc.countryCode,
                region: loc.region,
              }
            : undefined,
          profiles: bi.profiles?.map((p) => ({
            network: p.network,
            username: p.username,
            url: p.url,
          })),
        }
      : undefined,
    work: (cms.work ?? []).map(mapWork),
    education: (cms.education ?? []).map(mapEducation),
    skills: (cms.skills ?? []).map(mapSkill),
    interests: (cms.interests ?? []).map(mapInterest),
    volunteer: (cms.volunteer ?? []).map(mapVolunteer),
    projects: (cms.projects ?? []).map(mapProject),
    certificates: (cms.certificates ?? []).map((c) => ({
      name: c.title,
      url: c.link,
      summary: c.description,
    })),
    languages: (cms.resumeLanguages ?? []).map((l) => ({
      language: l.language,
      fluency: l.fluency,
    })),
    meta: {
      title: cms.title,
      language: cms.language?.value ?? cms.language?.label,
      lastModified: cms.updatedAt,
    },
  };
}

function mapWork(w: NonNullable<CmsResume['work']>[number]): JsonResumeWork {
  return {
    name: w.name,
    position: w.position,
    url: w.url,
    startDate: decodeDate(w.startDate),
    endDate: decodeDate(w.endDate),
    summary: w.summary,
    highlights: (w.highlights ?? []).map((h) => h.value ?? '').filter(Boolean),
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
    startDate: decodeDate(p.startDate),
    endDate: decodeDate(p.endDate),
    url: p.url,
  };
}
