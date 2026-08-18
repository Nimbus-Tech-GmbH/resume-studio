/**
 * Shared types for the CMS ⇄ JSON Resume transformer.
 *
 * The CMS shapes below mirror the actual Keystone SDL from `nt-keystone-cms`
 * (as of milestone 3). Notable divergences from earlier drafts:
 *   - No `order` field anywhere. Reorder is not persistable in MVP.
 *   - `ResumeBasicInformation.location` is a relation, not flat scalars.
 *   - `Resume.certificates` uses `Certification { title, description, link }`
 *     — no `date` / `issuer`.
 *   - `Resume.resumeLanguages` (not `languages`) holds spoken languages.
 *   - `Resume.language` is a `Language` relation for the UI/i18n code.
 */

// ─── JSON Resume shape (kept close to https://jsonresume.org/schema) ─────

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
    title?: string;
  };
}

// ─── CMS shape (real Keystone) ───────────────────────────────────────────

export interface CmsLanguageRef {
  id: string;
  label?: string;
  value?: string;
}

export interface CmsImageRef {
  id: string;
  src?: string;
}

export interface CmsResumeLocation {
  id: string;
  address?: string;
  postalCode?: string;
  city?: string;
  countryCode?: string;
  region?: string;
}

export interface CmsResumeProfile {
  id: string;
  network?: string;
  username?: string;
  url?: string;
}

export interface CmsBasicInformation {
  id: string;
  name?: string;
  label?: string;
  email?: string;
  phone?: string;
  url?: string;
  summary?: string;
  image?: CmsImageRef | null;
  location?: CmsResumeLocation | null;
  profiles?: CmsResumeProfile[];
}

export interface CmsHighlight {
  id: string;
  value?: string;
}

export interface CmsWork {
  id: string;
  name?: string;
  position?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  summary?: string;
  highlights?: CmsHighlight[];
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
}

export interface CmsSkill {
  id: string;
  name?: string;
  level?: string;
  keywords?: string;
}

export interface CmsInterest {
  id: string;
  name?: string;
  keywords?: string;
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
}

export interface CmsProject {
  id: string;
  name?: string;
  description?: string;
  highlights?: string;
  startDate?: string;
  endDate?: string;
  url?: string;
}

export interface CmsCertification {
  id: string;
  title?: string;
  description?: string;
  link?: string;
}

export interface CmsResumeLanguage {
  id: string;
  language?: string;
  fluency?: string;
}

export interface CmsResume {
  id: string;
  title?: string;
  updatedAt?: string;
  language?: CmsLanguageRef | null;
  basicInformation?: CmsBasicInformation;
  work?: CmsWork[];
  education?: CmsEducation[];
  skills?: CmsSkill[];
  interests?: CmsInterest[];
  volunteer?: CmsVolunteer[];
  projects?: CmsProject[];
  certificates?: CmsCertification[];
  resumeLanguages?: CmsResumeLanguage[];
}
