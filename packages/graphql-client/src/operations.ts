/**
 * Hand-written GraphQL operations against Keystone.
 *
 * These operations mirror the actual `Resume` type in `nt-keystone-cms`
 * (validated by introspection, see PLAN §10.2). No `orderBy` is used because
 * the CMS lists have no `order` field yet.
 *
 * Running `pnpm codegen` against a live Keystone endpoint replaces the
 * placeholder in `generated.ts` with strongly-typed variants.
 */

export const RESUME_FIELDS = /* GraphQL */ `
  fragment ResumeFields on Resume {
    id
    title
    updatedAt
    language {
      id
      label
      value
    }
    basicInformation {
      id
      name
      label
      email
      phone
      url
      summary
      image {
        id
        url
      }
      location {
        id
        address
        postalCode
        city
        countryCode
        region
      }
      profiles {
        id
        network
        username
        url
      }
    }
    work {
      id
      name
      position
      url
      startDate
      endDate
      summary
      highlights {
        id
        value
      }
    }
    education {
      id
      institution
      url
      area
      studyType
      startDate
      endDate
      score
      courses
    }
    skills {
      id
      name
      level
      keywords
    }
    interests {
      id
      name
      keywords
    }
    volunteer {
      id
      organization
      position
      url
      startDate
      endDate
      summary
      highlights
    }
    projects {
      id
      name
      description
      highlights
      startDate
      endDate
      url
    }
    certificates {
      id
      title
      description
      link
    }
    resumeLanguages {
      id
      language
      fluency
    }
  }
`;

export const LIST_RESUMES = /* GraphQL */ `
  query ListResumes {
    resumes {
      id
      title
      updatedAt
      language {
        id
        label
        value
      }
      basicInformation {
        id
        name
        label
      }
    }
  }
`;

export const GET_RESUME = /* GraphQL */ `
  ${RESUME_FIELDS}
  query GetResume($id: ID!) {
    resume(where: { id: $id }) {
      ...ResumeFields
    }
  }
`;

// ─── mutations ───────────────────────────────────────────────────────────

export const UPDATE_RESUME_BASIC_INFORMATION = /* GraphQL */ `
  mutation UpdateResumeBasicInformation(
    $id: ID!
    $data: ResumeBasicInformationUpdateInput!
  ) {
    updateResumeBasicInformation(where: { id: $id }, data: $data) {
      id
    }
  }
`;

export const UPDATE_RESUME_LOCATION = /* GraphQL */ `
  mutation UpdateResumeLocation($id: ID!, $data: ResumeLocationUpdateInput!) {
    updateResumeLocation(where: { id: $id }, data: $data) {
      id
    }
  }
`;

export const UPDATE_RESUME_WORK = /* GraphQL */ `
  mutation UpdateResumeWork($id: ID!, $data: ResumeWorkUpdateInput!) {
    updateResumeWork(where: { id: $id }, data: $data) {
      id
    }
  }
`;

export const CREATE_RESUME_HIGHLIGHT = /* GraphQL */ `
  mutation CreateResumeHighlight($data: ResumeHighlightCreateInput!) {
    createResumeHighlight(data: $data) {
      id
    }
  }
`;

export const UPDATE_RESUME_HIGHLIGHT = /* GraphQL */ `
  mutation UpdateResumeHighlight($id: ID!, $data: ResumeHighlightUpdateInput!) {
    updateResumeHighlight(where: { id: $id }, data: $data) {
      id
    }
  }
`;

export const DELETE_RESUME_HIGHLIGHT = /* GraphQL */ `
  mutation DeleteResumeHighlight($id: ID!) {
    deleteResumeHighlight(where: { id: $id }) {
      id
    }
  }
`;

export const UPDATE_RESUME_SKILL = /* GraphQL */ `
  mutation UpdateResumeSkill($id: ID!, $data: ResumeSkillUpdateInput!) {
    updateResumeSkill(where: { id: $id }, data: $data) {
      id
    }
  }
`;

export const UPDATE_RESUME_INTEREST = /* GraphQL */ `
  mutation UpdateResumeInterest($id: ID!, $data: ResumeInterestUpdateInput!) {
    updateResumeInterest(where: { id: $id }, data: $data) {
      id
    }
  }
`;

export const UPDATE_RESUME_EDUCATION = /* GraphQL */ `
  mutation UpdateResumeEducation($id: ID!, $data: ResumeEducationUpdateInput!) {
    updateResumeEducation(where: { id: $id }, data: $data) {
      id
    }
  }
`;

export const UPDATE_RESUME_VOLUNTEER = /* GraphQL */ `
  mutation UpdateResumeVolunteer($id: ID!, $data: ResumeVolunteerUpdateInput!) {
    updateResumeVolunteer(where: { id: $id }, data: $data) {
      id
    }
  }
`;

export const UPDATE_RESUME_PROJECT = /* GraphQL */ `
  mutation UpdateResumeProject($id: ID!, $data: ResumeProjectUpdateInput!) {
    updateResumeProject(where: { id: $id }, data: $data) {
      id
    }
  }
`;

export const UPDATE_RESUME_LANGUAGE = /* GraphQL */ `
  mutation UpdateResumeLanguage($id: ID!, $data: ResumeLanguageUpdateInput!) {
    updateResumeLanguage(where: { id: $id }, data: $data) {
      id
    }
  }
`;

export const UPDATE_CERTIFICATION = /* GraphQL */ `
  mutation UpdateCertification($id: ID!, $data: CertificationUpdateInput!) {
    updateCertification(where: { id: $id }, data: $data) {
      id
    }
  }
`;
