import { parseEvidenceRef, type EvidenceRef } from './evidence';

function isObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function asBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Invalid ${field}`);
  return value;
}

export type TextTarget =
  | { kind: 'resumeSummary' }
  | { kind: 'workSummary'; entryId: string }
  | { kind: 'workHighlight'; entryId: string; highlightId: string }
  | { kind: 'projectDescription'; entryId: string }
  | { kind: 'projectHighlight'; entryId: string; highlightId: string };

export type HighlightParent =
  | { kind: 'work'; entryId: string }
  | { kind: 'project'; entryId: string };

export interface SetTextOperation {
  kind: 'setText';
  target: TextTarget;
  expected: {
    exists: boolean;
    value: string | null;
  };
  value: string;
}

export interface AppendHighlightOperation {
  kind: 'appendHighlight';
  parent: HighlightParent;
  expectedHighlightsHash: string;
  value: string;
}

export type TailoringOperation = SetTextOperation | AppendHighlightOperation;

export interface Proposal {
  id: string;
  operation: TailoringOperation;
  requirementIds: string[];
  evidence: EvidenceRef[];
  rationale: string;
}

export type ProposalDecision = 'pending' | 'selected' | 'rejected';
export type ProposalApplicability = 'applicable' | 'conflict' | 'invalid';

function parseTextTarget(input: unknown): TextTarget {
  if (!isObject(input)) throw new Error('Invalid target');
  const kind = asString(input.kind, 'target.kind');
  if (kind === 'resumeSummary') return { kind: 'resumeSummary' };
  if (kind === 'workSummary') {
    return { kind: 'workSummary', entryId: asString(input.entryId, 'target.entryId') };
  }
  if (kind === 'workHighlight') {
    return {
      kind: 'workHighlight',
      entryId: asString(input.entryId, 'target.entryId'),
      highlightId: asString(input.highlightId, 'target.highlightId'),
    };
  }
  if (kind === 'projectDescription') {
    return {
      kind: 'projectDescription',
      entryId: asString(input.entryId, 'target.entryId'),
    };
  }
  if (kind === 'projectHighlight') {
    return {
      kind: 'projectHighlight',
      entryId: asString(input.entryId, 'target.entryId'),
      highlightId: asString(input.highlightId, 'target.highlightId'),
    };
  }
  throw new Error('Invalid target.kind');
}

function parseHighlightParent(input: unknown): HighlightParent {
  if (!isObject(input)) throw new Error('Invalid parent');
  const kind = asString(input.kind, 'parent.kind');
  if (kind === 'work') return { kind: 'work', entryId: asString(input.entryId, 'parent.entryId') };
  if (kind === 'project') {
    return { kind: 'project', entryId: asString(input.entryId, 'parent.entryId') };
  }
  throw new Error('Invalid parent.kind');
}

export function parseSetTextOperation(input: unknown): SetTextOperation {
  if (!isObject(input)) throw new Error('Invalid setText operation');
  if (asString(input.kind, 'operation.kind') !== 'setText') {
    throw new Error('Invalid setText operation kind');
  }
  if (!isObject(input.expected)) throw new Error('Invalid operation.expected');

  return {
    kind: 'setText',
    target: parseTextTarget(input.target),
    expected: {
      exists: asBoolean(input.expected.exists, 'operation.expected.exists'),
      value:
        input.expected.value === null
          ? null
          : asString(input.expected.value, 'operation.expected.value'),
    },
    value: asString(input.value, 'operation.value'),
  };
}

export function parseAppendHighlightOperation(input: unknown): AppendHighlightOperation {
  if (!isObject(input)) throw new Error('Invalid append operation');
  if (asString(input.kind, 'operation.kind') !== 'appendHighlight') {
    throw new Error('Invalid append operation kind');
  }
  return {
    kind: 'appendHighlight',
    parent: parseHighlightParent(input.parent),
    expectedHighlightsHash: asString(input.expectedHighlightsHash, 'operation.expectedHighlightsHash'),
    value: asString(input.value, 'operation.value'),
  };
}

export function parseTailoringOperation(input: unknown): TailoringOperation {
  if (!isObject(input)) throw new Error('Invalid operation');
  const kind = asString(input.kind, 'operation.kind');
  if (kind === 'setText') return parseSetTextOperation(input);
  if (kind === 'appendHighlight') return parseAppendHighlightOperation(input);
  throw new Error('Invalid operation.kind');
}

export function parseProposal(input: unknown): Proposal {
  if (!isObject(input)) throw new Error('Invalid proposal');
  const requirementIds = Array.isArray(input.requirementIds)
    ? input.requirementIds.map((item, index) => asString(item, `proposal.requirementIds[${index}]`))
    : [];
  if (requirementIds.length === 0) throw new Error('Invalid proposal.requirementIds');

  const evidence = Array.isArray(input.evidence)
    ? input.evidence.map((item) => parseEvidenceRef(item))
    : [];
  if (evidence.length === 0) throw new Error('Invalid proposal.evidence');

  return {
    id: asString(input.id, 'proposal.id'),
    operation: parseTailoringOperation(input.operation),
    requirementIds,
    evidence,
    rationale: asString(input.rationale, 'proposal.rationale'),
  };
}

export const TextTargetSchema = { parse: parseTextTarget };
export const HighlightParentSchema = { parse: parseHighlightParent };
export const SetTextOperationSchema = { parse: parseSetTextOperation };
export const AppendHighlightOperationSchema = { parse: parseAppendHighlightOperation };
export const TailoringOperationSchema = { parse: parseTailoringOperation };
export const ProposalSchema = { parse: parseProposal };
