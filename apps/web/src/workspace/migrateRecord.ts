import {
  AI_ERROR_CODES,
  groupChanges,
  hashResume,
  type AiErrorCode,
  type AnalysisEnvelope,
} from '@resume-studio/ai';
import type {
  AnyPersistedWorkspaceRecord,
  PersistedEditorState,
  PersistedTailoringState,
  PersistedWorkspaceRecord,
} from './schema';
import {
  connectionForPersistence,
  migrateConnectionProfile,
} from '@/features/ai-tailoring/connections/providers';
import type {
  AppliedAiTransaction,
  ChangeDecision,
} from '@/features/ai-tailoring/state/tailoringStore';

function migrateErrorCode(code: string | null | undefined): AiErrorCode | null {
  if (!code) return null;
  if ((AI_ERROR_CODES as readonly string[]).includes(code)) {
    return code as AiErrorCode;
  }
  return null;
}

const LEGACY_STATUS = new Set([
  'extracting',
  'comparing',
  'needs-language',
]);

const DECISIONS = new Set<ChangeDecision>(['pending', 'selected', 'rejected', 'applied']);

function migrateStatus(
  status: PersistedTailoringState['status'] | 'extracting' | 'comparing' | 'needs-language',
): PersistedTailoringState['status'] {
  if (status === 'extracting' || status === 'comparing') return 'interrupted';
  if (status === 'needs-language') return 'failed';
  if (status === 'streaming' || status === 'validating' || status === 'validating-output') {
    return 'interrupted';
  }
  return status;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Old records store a proposal-based envelope; drop anything not matching the current contract. */
function migrateAnalysis(value: unknown): AnalysisEnvelope | null {
  if (!isRecord(value) || value.schemaVersion !== 2) return null;
  if (
    typeof value.analysisId !== 'string' ||
    typeof value.workspaceId !== 'string' ||
    typeof value.documentEpoch !== 'string' ||
    typeof value.snapshotHash !== 'string' ||
    !isNonNegativeInt(value.baseRevision) ||
    !isNonNegativeInt(value.jobVersion)
  ) {
    return null;
  }
  if (!Array.isArray(value.withheldPaths) || !value.withheldPaths.every((row) => typeof row === 'string')) {
    return null;
  }
  const response = value.response;
  if (!isRecord(response) || !isRecord(response.resume)) return null;
  if (!Array.isArray(response.changes) || !Array.isArray(response.gaps)) return null;
  if (
    !response.changes.every(
      (row) => isRecord(row) && typeof row.id === 'string' && typeof row.group === 'string',
    )
  ) {
    return null;
  }
  return value as unknown as AnalysisEnvelope;
}

function migrateDecisions(
  input: unknown,
  analysis: AnalysisEnvelope | null,
): Record<string, ChangeDecision> {
  const decisions: Record<string, ChangeDecision> = {};
  if (analysis) {
    for (const group of groupChanges(analysis.response.changes)) {
      decisions[group.id] = 'pending';
    }
    if (isRecord(input)) {
      for (const groupId of Object.keys(decisions)) {
        const value = input[groupId];
        if (typeof value === 'string' && DECISIONS.has(value as ChangeDecision)) {
          decisions[groupId] = value as ChangeDecision;
        }
      }
    }
  }
  return decisions;
}

function isEditorIdentityState(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return ['work', 'projects'].every((section) => {
    const rows = value[section];
    if (!Array.isArray(rows)) return false;
    return rows.every(
      (row) =>
        isRecord(row) &&
        typeof row.entryId === 'string' &&
        Array.isArray(row.highlightIds) &&
        row.highlightIds.every((id) => typeof id === 'string'),
    );
  });
}

/** Legacy transactions stored only the applied deltas, not a full undo snapshot. */
function migrateLastApplied(value: unknown): AppliedAiTransaction | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== 'string' ||
    typeof value.analysisId !== 'string' ||
    typeof value.documentEpoch !== 'string' ||
    !isNonNegativeInt(value.baseRevision) ||
    !isRecord(value.beforeResume) ||
    !isEditorIdentityState(value.beforeEditorIds) ||
    typeof value.afterHash !== 'string'
  ) {
    return null;
  }
  return value as unknown as AppliedAiTransaction;
}

export function migrateWorkspaceRecord(
  record: AnyPersistedWorkspaceRecord,
): PersistedWorkspaceRecord {
  const legacy = record.tailoring as unknown as Record<string, unknown>;
  const connection = connectionForPersistence(migrateConnectionProfile(legacy.connection));
  const messages = ((legacy.messages as PersistedTailoringState['messages']) ?? []).map((message) =>
    message.status === 'streaming'
      ? { ...message, status: 'interrupted' as const }
      : message,
  );
  const lastAnalysis = migrateAnalysis(legacy.lastAnalysis);
  const previousStatus = legacy.status as PersistedTailoringState['status'];
  const status = migrateStatus(previousStatus);
  const analysisMatches =
    lastAnalysis !== null &&
    lastAnalysis.snapshotHash === hashResume(record.editor.resume) &&
    lastAnalysis.baseRevision === record.editor.revision;

  return {
    version: 2,
    scope: record.scope,
    updatedAt: record.updatedAt,
    editor: record.editor as PersistedEditorState,
    tailoring: {
      workspaceId: legacy.workspaceId as string,
      jobText: legacy.jobText as string,
      jobVersion: legacy.jobVersion as number,
      connectionVersion: (legacy.connectionVersion as number | undefined) ?? 0,
      conversationVersion: (legacy.conversationVersion as number | undefined) ?? 0,
      status: status === 'ready' && lastAnalysis && !analysisMatches ? 'outdated' : status,
      errorMessage: (legacy.errorMessage as string | null | undefined) ?? null,
      errorCode: migrateErrorCode(legacy.errorCode as string | null | undefined),
      lastAnalysis,
      changeDecisions: migrateDecisions(legacy.changeDecisions, lastAnalysis),
      connection,
      lastApplied: migrateLastApplied(legacy.lastApplied),
      messages,
    },
  };
}

export function isLegacyStatus(status: string): boolean {
  return LEGACY_STATUS.has(status);
}
