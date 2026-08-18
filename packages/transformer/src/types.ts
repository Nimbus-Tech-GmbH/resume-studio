/**
 * Shared types for the CMS ⇄ JSON Resume transformer.
 *
 * `CmsResume` mirrors the Keystone GraphQL shape (denormalized subset).
 * `JsonResume` mirrors the JSON Resume schema (https://jsonresume.org/schema).
 *
 * Milestone 1 will replace `CmsResume` with generated GraphQL types from
 * `@resume-studio/graphql-client` and lock `JsonResume` to the upstream schema.
 */

export interface JsonResumeBasics {
  name?: string;
  label?: string;
  image?: string;
  email?: string;
  phone?: string;
  url?: string;
  summary?: string;
  location?: {
    address?: string;
    postalCode?: string;
    city?: string;
    countryCode?: string;
    region?: string;
  };
  profiles?: Array<{ network?: string; username?: string; url?: string }>;
}

export interface JsonResumeWork {
  name?: string;
  position?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  summary?: string;
  highlights?: string[];
}

export interface JsonResumeEducation {
  institution?: string;
  url?: string;
  area?: string;
  studyType?: string;
  startDate?: string;
  endDate?: string;
  score?: string;
  courses?: string[];
}

export interface JsonResumeSkill {
  name?: string;
  level?: string;
  keywords?: string[];
}

export interface JsonResumeInterest {
  name?: string;
  keywords?: string[];
}

export interface JsonResumeVolunteer {
  organization?: string;
  position?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  summary?: string;
  highlights?: string[];
}

export interface JsonResumeProject {
  name?: string;
  description?: string;
  highlights?: string[];
  keywords?: string[];
  startDate?: string;
  endDate?: string;
  url?: string;
  roles?: string[];
  entity?: string;
  type?: string;
}

export interface JsonResumeCertificate {
  name?: string;
  date?: string;
  issuer?: string;
  url?: string;
  summary?: string;
}

export interface JsonResumeLanguage {
  language?: string;
  fluency?: string;
}

export interface JsonResumeReference {
  name?: string;
  reference?: string;
}

export interface JsonResume {
  basics?: JsonResumeBasics;
  work?: JsonResumeWork[];
  education?: JsonResumeEducation[];
  skills?: JsonResumeSkill[];
  interests?: JsonResumeInterest[];
  volunteer?: JsonResumeVolunteer[];
  projects?: JsonResumeProject[];
  certificates?: JsonResumeCertificate[];
  languages?: JsonResumeLanguage[];
  references?: JsonResumeReference[];
  meta?: {
    canonical?: string;
    version?: string;
    lastModified?: string;
    theme?: string;
    language?: string;
  };
}

/** CMS-side shapes. Placeholder — replaced by generated types in milestone 1. */
export interface CmsResume {
  id: string;
  language?: string;
  updatedAt?: string;
  basicInformation?: CmsBasicInformation;
  work?: CmsWork[];
  education?: CmsEducation[];
  skills?: CmsSkill[];
  interests?: CmsInterest[];
  volunteer?: CmsVolunteer[];
  projects?: CmsProject[];
  certifications?: CmsCertification[];
  languages?: CmsLanguage[];
}

export interface CmsBasicInformation {
  id: string;
  name?: string;
  label?: string;
  email?: string;
  phone?: string;
  url?: string;
  summary?: string;
  image?: { id: string; url?: string } | null;
  address?: string;
  postalCode?: string;
  city?: string;
  countryCode?: string;
  region?: string;
  profiles?: CmsProfile[];
}

export interface CmsProfile {
  id: string;
  network?: string;
  username?: string;
  url?: string;
}

export interface CmsWork {
  id: string;
  name?: string;
  position?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  summary?: string;
  order?: number;
  highlights?: CmsHighlight[];
}

export interface CmsHighlight {
  id: string;
  value?: string;
  order?: number;
}

export interface CmsEducation {
  id: string;
  institution?: string;
  url?: string;
  area?: string;
  studyType?: string;
  startDate?: string;
  endDate?: string;
  score?: string;
  courses?: string;
  order?: number;
}

export interface CmsSkill {
  id: string;
  name?: string;
  level?: string;
  keywords?: string;
  order?: number;
}

export interface CmsInterest {
  id: string;
  name?: string;
  keywords?: string;
  order?: number;
}

export interface CmsVolunteer {
  id: string;
  organization?: string;
  position?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  summary?: string;
  highlights?: string;
  order?: number;
}

export interface CmsProject {
  id: string;
  name?: string;
  description?: string;
  highlights?: string;
  keywords?: string;
  startDate?: string;
  endDate?: string;
  url?: string;
  order?: number;
}

export interface CmsCertification {
  id: string;
  title?: string;
  date?: string;
  issuer?: string;
  link?: string;
  description?: string;
  order?: number;
}

export interface CmsLanguage {
  id: string;
  language?: string;
  fluency?: string;
  order?: number;
}
