/**
 * Hand-written GraphQL operations against Keystone.
 *
 * These operations mirror the `CmsResume` shape declared in
 * `@resume-studio/transformer`. Once `pnpm codegen` runs against a live
 * Keystone endpoint the generated types can replace these.
 */

export const RESUME_FIELDS = /* GraphQL */ `
  fragment ResumeFields on Resume {
    id
    language
    updatedAt
    basicInformation {
      id
      name
      label
      email
      phone
      url
      summary
      address
      postalCode
      city
      countryCode
      region
      image {
        id
        url
      }
      profiles {
        id
        network
        username
        url
      }
    }
    work(orderBy: { order: asc }) {
      id
      name
      position
      url
      startDate
      endDate
      summary
      order
      highlights(orderBy: { order: asc }) {
        id
        value
        order
      }
    }
    education(orderBy: { order: asc }) {
      id
      institution
      url
      area
      studyType
      startDate
      endDate
      score
      courses
      order
    }
    skills(orderBy: { order: asc }) {
      id
      name
      level
      keywords
      order
    }
    interests(orderBy: { order: asc }) {
      id
      name
      keywords
      order
    }
    volunteer(orderBy: { order: asc }) {
      id
      organization
      position
      url
      startDate
      endDate
      summary
      highlights
      order
    }
    projects(orderBy: { order: asc }) {
      id
      name
      description
      highlights
      keywords
      startDate
      endDate
      url
      order
    }
    certifications(orderBy: { order: asc }) {
      id
      title
      date
      issuer
      link
      description
      order
    }
    languages(orderBy: { order: asc }) {
      id
      language
      fluency
      order
    }
  }
`;

export const LIST_RESUMES = /* GraphQL */ `
  query ListResumes {
    resumes {
      id
      language
      updatedAt
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

// ─── mutations (per-op) ──────────────────────────────────────────────────

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

export const UPDATE_CERTIFICATION = /* GraphQL */ `
  mutation UpdateCertification($id: ID!, $data: CertificationUpdateInput!) {
    updateCertification(where: { id: $id }, data: $data) {
      id
    }
  }
`;

export const UPDATE_RESUME = /* GraphQL */ `
  mutation UpdateResume($id: ID!, $data: ResumeUpdateInput!) {
    updateResume(where: { id: $id }, data: $data) {
      id
    }
  }
`;
