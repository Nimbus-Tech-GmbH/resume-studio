/**
 * JSON Resume → CMS mutation plan.
 * Milestone 0: skeleton + types. Real diffing lands in milestone 7.
 */

import type { CmsResume, JsonResume } from './types.js';

export type MutationOp =
  | { kind: 'updateResume'; id: string; data: Record<string, unknown> }
  | { kind: 'updateResumeBasicInformation'; id: string; data: Record<string, unknown> }
  | { kind: 'updateResumeWork'; id: string; data: Record<string, unknown> }
  | { kind: 'createResumeHighlight'; data: Record<string, unknown> }
  | { kind: 'updateResumeHighlight'; id: string; data: Record<string, unknown> }
  | { kind: 'deleteResumeHighlight'; id: string }
  | { kind: 'updateResumeSkill'; id: string; data: Record<string, unknown> }
  | { kind: 'updateResumeInterest'; id: string; data: Record<string, unknown> }
  | { kind: 'updateResumeEducation'; id: string; data: Record<string, unknown> }
  | { kind: 'updateResumeVolunteer'; id: string; data: Record<string, unknown> }
  | { kind: 'updateResumeProject'; id: string; data: Record<string, unknown> }
  | { kind: 'updateCertification'; id: string; data: Record<string, unknown> };

export interface MutationPlan {
  ops: MutationOp[];
  /** Fields the transformer refused to encode (bad date etc); block Save. */
  errors: Array<{ path: string; message: string }>;
}

export interface ToCmsInput {
  current: JsonResume;
  original: JsonResume;
  originalCms: CmsResume;
}

/**
 * TODO(milestone-7): diff current vs original, emit ordered ops
 * (create → update → delete), handle highlight relations, `set` for reorder.
 */
export function toCms(_input: ToCmsInput): MutationPlan {
  return { ops: [], errors: [] };
}
