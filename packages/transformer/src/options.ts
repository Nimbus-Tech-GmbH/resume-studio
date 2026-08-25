/**
 * Option lists mirrored from the Keystone `select` fields in `schema.ts`
 * (`nt-keystone-cms`). Single source of truth for the editor dropdowns and
 * the ajv enum validation — keep in sync with the CMS list definitions.
 */

// ResumeSkill.level
export const SKILL_LEVELS = [
  'Beginner',
  'Intermediate',
  'Advanced',
  'Expert',
  'Master',
] as const;

// ResumeLanguage.fluency
export const FLUENCY_LEVELS = [
  'Elementary',
  'Limited Working',
  'Professional Working',
  'Full Professional',
  'Native',
] as const;

// ResumeProfile.network (profiles are not yet editable in the editor,
// but the list is kept here for completeness)
export const PROFILE_NETWORKS = [
  'LinkedIn',
  'GitHub',
  'Twitter',
  'Instagram',
  'Literal',
  'Other',
] as const;

export function toOptions(
  values: readonly string[],
): Array<{ label: string; value: string }> {
  return values.map((v) => ({ label: v, value: v }));
}
