/** Strict LLM tailoring response contract. */

export type ChangeOperation = 'rewrite' | 'reorder' | 'delete' | 'narrow';

export interface TailoringChange {
  id: string;
  group: string;
  path: string;
  op: ChangeOperation;
  before: unknown;
  after: unknown;
  reason: string;
  evidence: string[];
}

export type GapKind = 'missing_requirement' | 'ignored_constraint';

export interface TailoringGap {
  kind: GapKind;
  requirement: string;
  detail: string;
  searched: string[];
}

export interface TailoredResumeResponse {
  resume: Record<string, unknown>;
  changes: TailoringChange[];
  gaps: TailoringGap[];
}

export interface AnalysisEnvelope {
  schemaVersion: 2;
  analysisId: string;
  workspaceId: string;
  documentEpoch: string;
  baseRevision: number;
  snapshotHash: string;
  jobVersion: number;
  withheldPaths: string[];
  response: TailoredResumeResponse;
}

export interface ChangeGroup {
  id: string;
  changes: TailoringChange[];
}

export function groupChanges(changes: readonly TailoringChange[]): ChangeGroup[] {
  const groups = new Map<string, TailoringChange[]>();
  for (const change of changes) {
    const rows = groups.get(change.group) ?? [];
    rows.push(change);
    groups.set(change.group, rows);
  }
  return [...groups.entries()].map(([id, rows]) => ({ id, changes: rows }));
}
