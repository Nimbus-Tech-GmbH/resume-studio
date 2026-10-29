import {
  applyTailoringChanges,
  deepEqual,
  hashResume,
  undoApplyTransaction,
  type AnalysisEnvelope,
} from '@resume-studio/ai';
import type { JsonResume } from '@resume-studio/transformer';
import {
  cloneEditorIds,
  type EditorIdentityState,
} from '@/state/editorStore';
import type { AppliedAiTransaction } from '../state/tailoringStore';

interface ApplyInput {
  analysis: AnalysisEnvelope;
  resume: JsonResume;
  editorIds: EditorIdentityState;
  selectedGroupIds: string[];
  documentEpoch: string;
  workspaceId: string;
  baseRevision: number;
  jobVersion: number;
  snapshotHash: string;
  jsonBufferValid: boolean;
  jsonBufferDirty: boolean;
}

export interface ApplyConflict {
  source: string;
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

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function nextHighlightIds(
  previous: readonly string[],
  before: readonly string[],
  after: readonly string[],
): string[] {
  if (deepEqual(before, after)) return [...previous];
  return after.map(() => randomId());
}

function nextEditorIds(
  prev: EditorIdentityState,
  beforeResume: JsonResume,
  nextResume: JsonResume,
): EditorIdentityState {
  const work = (nextResume.work ?? []).map((entry, index) => {
    const prevEntry = prev.work[index];
    const beforeHighlights = beforeResume.work?.[index]?.highlights ?? [];
    const afterHighlights = entry.highlights ?? [];
    return {
      entryId: prevEntry?.entryId ?? randomId(),
      highlightIds: nextHighlightIds(
        prevEntry?.highlightIds ?? [],
        beforeHighlights,
        afterHighlights,
      ),
    };
  });
  const projects = (nextResume.projects ?? []).map((entry, index) => {
    const prevEntry = prev.projects[index];
    const beforeHighlights = beforeResume.projects?.[index]?.highlights ?? [];
    const afterHighlights = entry.highlights ?? [];
    return {
      entryId: prevEntry?.entryId ?? randomId(),
      highlightIds: nextHighlightIds(
        prevEntry?.highlightIds ?? [],
        beforeHighlights,
        afterHighlights,
      ),
    };
  });
  return { work, projects };
}

export function applyTailoringBatch(input: ApplyInput): ApplyResult {
  if (!input.jsonBufferValid || input.jsonBufferDirty) {
    return {
      ok: false,
      conflicts: [
        {
          source: 'json-buffer',
          message: 'JSON editor has invalid or unsynced content. Fix it before apply.',
        },
      ],
    };
  }

  if (input.analysis.workspaceId !== input.workspaceId) {
    return {
      ok: false,
      conflicts: [{ source: 'context', message: 'Analysis workspace does not match.' }],
    };
  }

  if (input.analysis.documentEpoch !== input.documentEpoch) {
    return {
      ok: false,
      conflicts: [{ source: 'context', message: 'Document changed since analysis.' }],
    };
  }

  if (input.analysis.baseRevision !== input.baseRevision) {
    return {
      ok: false,
      conflicts: [
        {
          source: 'context',
          message: 'Editor revision changed since analysis. Re-run before apply.',
        },
      ],
    };
  }

  if (input.analysis.jobVersion !== input.jobVersion) {
    return {
      ok: false,
      conflicts: [
        {
          source: 'context',
          message: 'Job description changed since analysis. Re-run before apply.',
        },
      ],
    };
  }

  if (input.analysis.snapshotHash !== input.snapshotHash) {
    return {
      ok: false,
      conflicts: [
        {
          source: 'context',
          message: 'Resume evidence changed since analysis. Re-run before apply.',
        },
      ],
    };
  }

  if (input.selectedGroupIds.length === 0) {
    return {
      ok: false,
      conflicts: [{ source: 'selection', message: 'Select at least one change group.' }],
    };
  }

  const beforeResume = cloneResume(input.resume);
  const beforeEditorIds = cloneEditorIds(input.editorIds);

  let applied: JsonResume;
  try {
    applied = applyTailoringChanges(
      input.resume as Record<string, unknown>,
      input.analysis.response,
      input.selectedGroupIds,
    ) as unknown as JsonResume;
  } catch (error) {
    return {
      ok: false,
      conflicts: [
        {
          source: 'apply',
          message: error instanceof Error ? error.message : 'Apply failed.',
        },
      ],
    };
  }

  const nextIds = nextEditorIds(beforeEditorIds, beforeResume, applied);

  return {
    ok: true,
    resume: applied,
    editorIds: nextIds,
    transaction: {
      id: randomId(),
      analysisId: input.analysis.analysisId,
      documentEpoch: input.documentEpoch,
      baseRevision: input.baseRevision,
      beforeResume,
      beforeEditorIds,
      afterHash: hashResume(applied),
    },
  };
}

export function undoTailoringTransaction(input: {
  resume: JsonResume;
  transaction: AppliedAiTransaction;
}): { ok: true; resume: JsonResume; editorIds: EditorIdentityState } | { ok: false; reason: string } {
  const undo = undoApplyTransaction(
    input.resume as unknown as Record<string, unknown>,
    {
      id: input.transaction.id,
      before: input.transaction.beforeResume as unknown as Record<string, unknown>,
      afterHash: input.transaction.afterHash,
      appliedGroupIds: [],
    },
    hashResume,
  );
  if (!undo.ok) {
    return { ok: false, reason: undo.reason };
  }
  return {
    ok: true,
    resume: undo.resume as unknown as JsonResume,
    editorIds: cloneEditorIds(input.transaction.beforeEditorIds),
  };
}
