import {
  CREATE_RESUME_HIGHLIGHT,
  DELETE_RESUME_HIGHLIGHT,
  UPDATE_CERTIFICATION,
  UPDATE_RESUME,
  UPDATE_RESUME_BASIC_INFORMATION,
  UPDATE_RESUME_EDUCATION,
  UPDATE_RESUME_HIGHLIGHT,
  UPDATE_RESUME_INTEREST,
  UPDATE_RESUME_PROJECT,
  UPDATE_RESUME_SKILL,
  UPDATE_RESUME_VOLUNTEER,
  UPDATE_RESUME_WORK,
} from '@resume-studio/graphql-client';
import type { MutationOp } from '@resume-studio/transformer';
import { gqlClient } from './client.js';

/**
 * Execute a plan of mutation ops. Ordering rules:
 *   1. creates first (so later `set` reorderings can reference new ids),
 *   2. then updates,
 *   3. then deletes.
 *
 * Errors surface per-op so the caller can present granular toasts. We do not
 * roll back local state — PLAN §4 accepts last-write-wins.
 */
export interface OpResult {
  op: MutationOp;
  ok: boolean;
  error?: string;
}

export async function executeSave(ops: readonly MutationOp[]): Promise<OpResult[]> {
  const creates = ops.filter((o) => o.kind === 'createResumeHighlight');
  const deletes = ops.filter((o) => o.kind === 'deleteResumeHighlight');
  const updates = ops.filter(
    (o) => o.kind !== 'createResumeHighlight' && o.kind !== 'deleteResumeHighlight',
  );
  const ordered = [...creates, ...updates, ...deletes];

  const results: OpResult[] = [];
  for (const op of ordered) {
    try {
      await runOne(op);
      results.push({ op, ok: true });
    } catch (err) {
      results.push({
        op,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}

async function runOne(op: MutationOp): Promise<void> {
  switch (op.kind) {
    case 'updateResumeBasicInformation':
      await gqlClient.request(UPDATE_RESUME_BASIC_INFORMATION, { id: op.id, data: op.data });
      return;
    case 'updateResumeWork':
      await gqlClient.request(UPDATE_RESUME_WORK, { id: op.id, data: op.data });
      return;
    case 'createResumeHighlight':
      await gqlClient.request(CREATE_RESUME_HIGHLIGHT, { data: op.data });
      return;
    case 'updateResumeHighlight':
      await gqlClient.request(UPDATE_RESUME_HIGHLIGHT, { id: op.id, data: op.data });
      return;
    case 'deleteResumeHighlight':
      await gqlClient.request(DELETE_RESUME_HIGHLIGHT, { id: op.id });
      return;
    case 'updateResumeSkill':
      await gqlClient.request(UPDATE_RESUME_SKILL, { id: op.id, data: op.data });
      return;
    case 'updateResumeInterest':
      await gqlClient.request(UPDATE_RESUME_INTEREST, { id: op.id, data: op.data });
      return;
    case 'updateResumeEducation':
      await gqlClient.request(UPDATE_RESUME_EDUCATION, { id: op.id, data: op.data });
      return;
    case 'updateResumeVolunteer':
      await gqlClient.request(UPDATE_RESUME_VOLUNTEER, { id: op.id, data: op.data });
      return;
    case 'updateResumeProject':
      await gqlClient.request(UPDATE_RESUME_PROJECT, { id: op.id, data: op.data });
      return;
    case 'updateCertification':
      await gqlClient.request(UPDATE_CERTIFICATION, { id: op.id, data: op.data });
      return;
    case 'updateResume':
      await gqlClient.request(UPDATE_RESUME, { id: op.id, data: op.data });
      return;
    default: {
      const _exhaustive: never = op;
      throw new Error(`Unhandled op: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
