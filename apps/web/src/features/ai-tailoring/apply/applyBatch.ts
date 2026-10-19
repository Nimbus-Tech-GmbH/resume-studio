import {
  AppendHighlightOperationSchema,
  SetTextOperationSchema,
} from '@resume-studio/ai-contracts';
import type {
  AnalysisEnvelope,
  HighlightParent,
  Proposal,
  TailoringOperation,
  TextTarget,
} from '@resume-studio/ai-contracts';
import type { JsonResume } from '@resume-studio/transformer';
import {
  cloneEditorIds,
  hashHighlights,
  type EditorIdentityState,
} from '@/state/editorStore';
import { validateResume } from '@/validation/schema';
import type {
  AppliedAiTransaction,
  AppliedAppendHighlightChange,
  AppliedSetTextChange,
} from '../state/tailoringStore';

interface TargetRef {
  get(): { exists: boolean; value: string | null };
  set(value: string): void;
}

interface ApplyInput {
  analysis: AnalysisEnvelope;
  resume: JsonResume;
  editorIds: EditorIdentityState;
  selectedProposalIds: string[];
  proposalEdits: Record<string, string>;
  documentEpoch: string;
}

export interface ApplyConflict {
  proposalId: string;
  message: string;
}

interface ApplyOk {
  ok: true;
  resume: JsonResume;
  editorIds: EditorIdentityState;
  transaction: AppliedAiTransaction;
}

interface ApplyFail {
  ok: false;
  conflicts: ApplyConflict[];
}

export type ApplyResult = ApplyOk | ApplyFail;

function cloneResume(resume: JsonResume): JsonResume {
  if (typeof structuredClone === 'function') {
    return structuredClone(resume);
  }
  return JSON.parse(JSON.stringify(resume)) as JsonResume;
}

function targetKey(target: TextTarget): string {
  return JSON.stringify(target);
}

function parentKey(parent: HighlightParent): string {
  return JSON.stringify(parent);
}

function getWorkIndex(ids: EditorIdentityState, entryId: string): number {
  return ids.work.findIndex((entry) => entry.entryId === entryId);
}

function getProjectIndex(ids: EditorIdentityState, entryId: string): number {
  return ids.projects.findIndex((entry) => entry.entryId === entryId);
}

function resolveTextTarget(
  resume: JsonResume,
  ids: EditorIdentityState,
  target: TextTarget,
): TargetRef | null {
  if (target.kind === 'resumeSummary') {
    return {
      get: () => ({
        exists: resume.basics?.summary !== undefined,
        value: resume.basics?.summary ?? null,
      }),
      set: (value: string) => {
        resume.basics = resume.basics ?? {};
        resume.basics.summary = value;
      },
    };
  }

  if (target.kind === 'workSummary') {
    const workIndex = getWorkIndex(ids, target.entryId);
    if (workIndex < 0) return null;
    const row = resume.work?.[workIndex];
    if (!row) return null;
    return {
      get: () => ({
        exists: row.summary !== undefined,
        value: row.summary ?? null,
      }),
      set: (value: string) => {
        row.summary = value;
      },
    };
  }

  if (target.kind === 'projectDescription') {
    const projectIndex = getProjectIndex(ids, target.entryId);
    if (projectIndex < 0) return null;
    const row = resume.projects?.[projectIndex];
    if (!row) return null;
    return {
      get: () => ({
        exists: row.description !== undefined,
        value: row.description ?? null,
      }),
      set: (value: string) => {
        row.description = value;
      },
    };
  }

  if (target.kind === 'workHighlight') {
    const workIndex = getWorkIndex(ids, target.entryId);
    if (workIndex < 0) return null;
    const row = resume.work?.[workIndex];
    const highlightIndex = ids.work[workIndex]?.highlightIds.findIndex(
      (id) => id === target.highlightId,
    );
    if (!row || highlightIndex === undefined || highlightIndex < 0) return null;

    row.highlights = row.highlights ?? [];
    return {
      get: () => ({
        exists: highlightIndex < row.highlights!.length,
        value: row.highlights![highlightIndex] ?? null,
      }),
      set: (value: string) => {
        row.highlights![highlightIndex] = value;
      },
    };
  }

  const projectIndex = getProjectIndex(ids, target.entryId);
  if (projectIndex < 0) return null;
  const row = resume.projects?.[projectIndex];
  const highlightIndex = ids.projects[projectIndex]?.highlightIds.findIndex(
    (id) => id === target.highlightId,
  );
  if (!row || highlightIndex === undefined || highlightIndex < 0) return null;

  row.highlights = row.highlights ?? [];
  return {
    get: () => ({
      exists: highlightIndex < row.highlights!.length,
      value: row.highlights![highlightIndex] ?? null,
    }),
    set: (value: string) => {
      row.highlights![highlightIndex] = value;
    },
  };
}

function resolveParentHighlights(
  resume: JsonResume,
  ids: EditorIdentityState,
  parent: HighlightParent,
): {
  values: string[];
  idsRef: string[];
} | null {
  if (parent.kind === 'work') {
    const workIndex = getWorkIndex(ids, parent.entryId);
    if (workIndex < 0) return null;
    const row = resume.work?.[workIndex];
    const idRow = ids.work[workIndex];
    if (!row || !idRow) return null;
    row.highlights = row.highlights ?? [];
    return { values: row.highlights, idsRef: idRow.highlightIds };
  }

  const projectIndex = getProjectIndex(ids, parent.entryId);
  if (projectIndex < 0) return null;
  const row = resume.projects?.[projectIndex];
  const idRow = ids.projects[projectIndex];
  if (!row || !idRow) return null;
  row.highlights = row.highlights ?? [];
  return { values: row.highlights, idsRef: idRow.highlightIds };
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function collectBlockingErrors(resume: JsonResume): Set<string> {
  return new Set(
    validateResume(resume)
      .filter((issue) => issue.severity === 'error')
      .map((issue) => `${issue.path}|${issue.message}`),
  );
}

function operationWithEditedValue(operation: TailoringOperation, nextValue: string): TailoringOperation {
  if (operation.kind === 'setText') {
    return SetTextOperationSchema.parse({
      ...operation,
      value: nextValue,
    });
  }

  return AppendHighlightOperationSchema.parse({
    ...operation,
    value: nextValue,
  });
}

function byId(proposals: Proposal[]): Map<string, Proposal> {
  return new Map(proposals.map((proposal) => [proposal.id, proposal]));
}

export function applyTailoringBatch(input: ApplyInput): ApplyResult {
  const proposalMap = byId(input.analysis.proposals);
  const conflicts: ApplyConflict[] = [];
  const mutatedResume = cloneResume(input.resume);
  const mutatedIds = cloneEditorIds(input.editorIds);

  const touchedTargets = new Set<string>();
  const appendParents = new Map<string, HighlightParent>();

  const beforeBlocking = collectBlockingErrors(input.resume);

  const changeSet: Array<AppliedSetTextChange | AppliedAppendHighlightChange> = [];

  for (const proposalId of input.selectedProposalIds) {
    const proposal = proposalMap.get(proposalId);
    if (!proposal) {
      conflicts.push({ proposalId, message: 'Unknown proposal id.' });
      continue;
    }

    const editedValue = input.proposalEdits[proposal.id] ?? proposal.operation.value;
    const operation = operationWithEditedValue(proposal.operation, editedValue);

    if (operation.value.trim().length === 0) {
      conflicts.push({
        proposalId,
        message: 'Empty or whitespace-only values are not allowed.',
      });
      continue;
    }

    if (operation.kind === 'setText') {
      const key = targetKey(operation.target);
      if (touchedTargets.has(key)) {
        conflicts.push({
          proposalId,
          message: 'Multiple selected proposals target the same field.',
        });
        continue;
      }
      touchedTargets.add(key);

      const ref = resolveTextTarget(mutatedResume, mutatedIds, operation.target);
      if (!ref) {
        conflicts.push({ proposalId, message: 'Target not found in current draft.' });
        continue;
      }

      const current = ref.get();
      if (
        current.exists !== operation.expected.exists ||
        current.value !== operation.expected.value
      ) {
        conflicts.push({
          proposalId,
          message: 'Target changed since analysis snapshot.',
        });
        continue;
      }

      ref.set(operation.value);
      changeSet.push({
        kind: 'setText',
        target: key,
        existedBefore: current.exists,
        beforeValue: current.value,
        afterValue: operation.value,
      });
      continue;
    }

    const parent = resolveParentHighlights(mutatedResume, mutatedIds, operation.parent);
    if (!parent) {
      conflicts.push({ proposalId, message: 'Append target parent not found.' });
      continue;
    }

    const key = parentKey(operation.parent);
    if (!appendParents.has(key)) {
      appendParents.set(key, operation.parent);
      const currentHash = hashHighlights(parent.values);
      if (currentHash !== operation.expectedHighlightsHash) {
        conflicts.push({
          proposalId,
          message: 'Highlights changed since analysis snapshot.',
        });
        continue;
      }
    }

    parent.values.push(operation.value);
    const createdHighlightId = randomId();
    parent.idsRef.push(createdHighlightId);
    changeSet.push({
      kind: 'appendHighlight',
      parent: key,
      createdHighlightId,
      value: operation.value,
    });
  }

  if (conflicts.length > 0) {
    return { ok: false, conflicts };
  }

  const afterBlocking = collectBlockingErrors(mutatedResume);
  for (const issue of afterBlocking) {
    if (!beforeBlocking.has(issue)) {
      return {
        ok: false,
        conflicts: [
          {
            proposalId: 'validation',
            message: 'Applying selected proposals introduces new blocking validation errors.',
          },
        ],
      };
    }
  }

  return {
    ok: true,
    resume: mutatedResume,
    editorIds: mutatedIds,
    transaction: {
      id: randomId(),
      analysisId: input.analysis.analysisId,
      documentEpoch: input.documentEpoch,
      changeSet,
    },
  };
}

export function undoTailoringTransaction(input: {
  resume: JsonResume;
  editorIds: EditorIdentityState;
  transaction: AppliedAiTransaction;
}): { ok: true; resume: JsonResume; editorIds: EditorIdentityState } | { ok: false; reason: string } {
  const nextResume = cloneResume(input.resume);
  const nextIds = cloneEditorIds(input.editorIds);

  for (const change of input.transaction.changeSet) {
    if (change.kind === 'setText') {
      const target = JSON.parse(change.target) as TextTarget;
      const ref = resolveTextTarget(nextResume, nextIds, target);
      if (!ref) {
        return { ok: false, reason: 'Cannot undo because a target no longer exists.' };
      }
      const now = ref.get();
      if (!now.exists || now.value !== change.afterValue) {
        return {
          ok: false,
          reason: 'Cannot undo because affected text changed after apply.',
        };
      }

      if (change.existedBefore) {
        ref.set(change.beforeValue ?? '');
      } else {
        if (target.kind === 'resumeSummary') {
          if (nextResume.basics) {
            delete nextResume.basics.summary;
          }
        } else if (target.kind === 'workSummary') {
          const index = getWorkIndex(nextIds, target.entryId);
          if (index >= 0 && nextResume.work?.[index]) {
            delete nextResume.work[index]!.summary;
          }
        } else if (target.kind === 'projectDescription') {
          const index = getProjectIndex(nextIds, target.entryId);
          if (index >= 0 && nextResume.projects?.[index]) {
            delete nextResume.projects[index]!.description;
          }
        }
      }
      continue;
    }

    const parent = JSON.parse(change.parent) as HighlightParent;
    const target = resolveParentHighlights(nextResume, nextIds, parent);
    if (!target) {
      return {
        ok: false,
        reason: 'Cannot undo because append target no longer exists.',
      };
    }

    const idIndex = target.idsRef.findIndex((id) => id === change.createdHighlightId);
    if (idIndex < 0) {
      return {
        ok: false,
        reason: 'Cannot undo because appended highlight identity was removed.',
      };
    }

    if (target.values[idIndex] !== change.value) {
      return {
        ok: false,
        reason: 'Cannot undo because appended highlight text changed.',
      };
    }

    target.values.splice(idIndex, 1);
    target.idsRef.splice(idIndex, 1);
  }

  return {
    ok: true,
    resume: nextResume,
    editorIds: nextIds,
  };
}
