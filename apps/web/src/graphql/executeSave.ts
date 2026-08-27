import {
  CREATE_RESUME_EDUCATION,
  CREATE_RESUME_HIGHLIGHT,
  CREATE_RESUME_INTEREST,
  CREATE_RESUME_LANGUAGE,
  CREATE_RESUME_PROJECT,
  CREATE_RESUME_SKILL,
  CREATE_RESUME_VOLUNTEER,
  CREATE_RESUME_WORK,
  DELETE_RESUME_EDUCATION,
  DELETE_RESUME_HIGHLIGHT,
  DELETE_RESUME_INTEREST,
  DELETE_RESUME_LANGUAGE,
  DELETE_RESUME_PROJECT,
  DELETE_RESUME_SKILL,
  DELETE_RESUME_VOLUNTEER,
  DELETE_RESUME_WORK,
  UPDATE_CERTIFICATION,
  UPDATE_RESUME,
  UPDATE_RESUME_BASIC_INFORMATION,
  UPDATE_RESUME_EDUCATION,
  UPDATE_RESUME_HIGHLIGHT,
  UPDATE_RESUME_INTEREST,
  UPDATE_RESUME_LANGUAGE,
  UPDATE_RESUME_LOCATION,
  UPDATE_RESUME_PROJECT,
  UPDATE_RESUME_SKILL,
  UPDATE_RESUME_VOLUNTEER,
  UPDATE_RESUME_WORK,
} from '@resume-studio/graphql-client';
import type { MutationOp } from '@resume-studio/transformer';
import { gqlClient } from './client';

/**
 * Execute a plan of mutation ops.
 *
 * Ordering:
 *   1. creates first (so any later reference by id is safe),
 *   2. then updates,
 *   3. then deletes.
 *
 * Errors surface per-op so the caller can present granular toasts.
 * No local rollback — PLAN §4 accepts last-write-wins.
 */
export interface OpResult {
  op: MutationOp;
  ok: boolean;
  error?: string;
}

function bucket(kind: MutationOp['kind']): 0 | 1 | 2 {
  if (kind.startsWith('create')) return 0;
  if (kind.startsWith('delete')) return 2;
  return 1;
}

export async function executeSave(ops: readonly MutationOp[]): Promise<OpResult[]> {
  const ordered = [...ops].sort((a, b) => bucket(a.kind) - bucket(b.kind));

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
    case 'updateResumeLocation':
      await gqlClient.request(UPDATE_RESUME_LOCATION, { id: op.id, data: op.data });
      return;
    case 'updateResume':
      await gqlClient.request(UPDATE_RESUME, { id: op.id, data: op.data });
      return;

    case 'createResumeWork':
      await gqlClient.request(CREATE_RESUME_WORK, { data: op.data });
      return;
    case 'updateResumeWork':
      await gqlClient.request(UPDATE_RESUME_WORK, { id: op.id, data: op.data });
      return;
    case 'deleteResumeWork':
      await gqlClient.request(DELETE_RESUME_WORK, { id: op.id });
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

    case 'createResumeSkill':
      await gqlClient.request(CREATE_RESUME_SKILL, { data: op.data });
      return;
    case 'updateResumeSkill':
      await gqlClient.request(UPDATE_RESUME_SKILL, { id: op.id, data: op.data });
      return;
    case 'deleteResumeSkill':
      await gqlClient.request(DELETE_RESUME_SKILL, { id: op.id });
      return;

    case 'createResumeInterest':
      await gqlClient.request(CREATE_RESUME_INTEREST, { data: op.data });
      return;
    case 'updateResumeInterest':
      await gqlClient.request(UPDATE_RESUME_INTEREST, { id: op.id, data: op.data });
      return;
    case 'deleteResumeInterest':
      await gqlClient.request(DELETE_RESUME_INTEREST, { id: op.id });
      return;

    case 'createResumeEducation':
      await gqlClient.request(CREATE_RESUME_EDUCATION, { data: op.data });
      return;
    case 'updateResumeEducation':
      await gqlClient.request(UPDATE_RESUME_EDUCATION, { id: op.id, data: op.data });
      return;
    case 'deleteResumeEducation':
      await gqlClient.request(DELETE_RESUME_EDUCATION, { id: op.id });
      return;

    case 'createResumeVolunteer':
      await gqlClient.request(CREATE_RESUME_VOLUNTEER, { data: op.data });
      return;
    case 'updateResumeVolunteer':
      await gqlClient.request(UPDATE_RESUME_VOLUNTEER, { id: op.id, data: op.data });
      return;
    case 'deleteResumeVolunteer':
      await gqlClient.request(DELETE_RESUME_VOLUNTEER, { id: op.id });
      return;

    case 'createResumeProject':
      await gqlClient.request(CREATE_RESUME_PROJECT, { data: op.data });
      return;
    case 'updateResumeProject':
      await gqlClient.request(UPDATE_RESUME_PROJECT, { id: op.id, data: op.data });
      return;
    case 'deleteResumeProject':
      await gqlClient.request(DELETE_RESUME_PROJECT, { id: op.id });
      return;

    case 'createResumeLanguage':
      await gqlClient.request(CREATE_RESUME_LANGUAGE, { data: op.data });
      return;
    case 'updateResumeLanguage':
      await gqlClient.request(UPDATE_RESUME_LANGUAGE, { id: op.id, data: op.data });
      return;
    case 'deleteResumeLanguage':
      await gqlClient.request(DELETE_RESUME_LANGUAGE, { id: op.id });
      return;

    case 'updateCertification':
      await gqlClient.request(UPDATE_CERTIFICATION, { id: op.id, data: op.data });
      return;

    default: {
      const _exhaustive: never = op;
      throw new Error(`Unhandled op: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
