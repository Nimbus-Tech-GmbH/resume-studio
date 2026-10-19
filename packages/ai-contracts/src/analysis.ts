import {
  parseEvidenceQuestion,
  type EvidenceQuestion,
} from './evidence';
import { parseProposal, type Proposal } from './proposals';

function isObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function asNonNegativeInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

export type RequirementStatus =
  | 'supported'
  | 'partial'
  | 'not-evidenced'
  | 'unclear';

export interface Requirement {
  id: string;
  text: string;
  jobQuote: string;
  importance: 'high' | 'medium' | 'low';
  status: RequirementStatus;
}

export interface AnalysisEnvelope {
  schemaVersion: 1;
  analysisId: string;
  workspaceId: string;
  documentEpoch: string;
  baseRevision: number;
  snapshotHash: string;
  jobVersion: number;
  answerVersion: number;
  requirements: Requirement[];
  proposals: Proposal[];
  questions: EvidenceQuestion[];
}

function parseRequirementStatus(input: unknown): RequirementStatus {
  const status = asString(input, 'requirement.status');
  if (
    status === 'supported' ||
    status === 'partial' ||
    status === 'not-evidenced' ||
    status === 'unclear'
  ) {
    return status;
  }
  throw new Error('Invalid requirement.status');
}

function parseRequirementImportance(input: unknown): 'high' | 'medium' | 'low' {
  const importance = asString(input, 'requirement.importance');
  if (importance === 'high' || importance === 'medium' || importance === 'low') {
    return importance;
  }
  throw new Error('Invalid requirement.importance');
}

export function parseRequirement(input: unknown): Requirement {
  if (!isObject(input)) throw new Error('Invalid requirement');

  return {
    id: asString(input.id, 'requirement.id'),
    text: asString(input.text, 'requirement.text'),
    jobQuote: asString(input.jobQuote, 'requirement.jobQuote'),
    importance: parseRequirementImportance(input.importance),
    status: parseRequirementStatus(input.status),
  };
}

export function parseAnalysisEnvelope(input: unknown): AnalysisEnvelope {
  if (!isObject(input)) throw new Error('Invalid analysis envelope');
  if (input.schemaVersion !== 1) throw new Error('Invalid schemaVersion');

  const requirements = Array.isArray(input.requirements)
    ? input.requirements.map((item) => parseRequirement(item))
    : [];
  const proposals = Array.isArray(input.proposals)
    ? input.proposals.map((item) => parseProposal(item))
    : [];
  const questions = Array.isArray(input.questions)
    ? input.questions.map((item) => parseEvidenceQuestion(item))
    : [];

  return {
    schemaVersion: 1,
    analysisId: asString(input.analysisId, 'analysis.analysisId'),
    workspaceId: asString(input.workspaceId, 'analysis.workspaceId'),
    documentEpoch: asString(input.documentEpoch, 'analysis.documentEpoch'),
    baseRevision: asNonNegativeInt(input.baseRevision, 'analysis.baseRevision'),
    snapshotHash: asString(input.snapshotHash, 'analysis.snapshotHash'),
    jobVersion: asNonNegativeInt(input.jobVersion, 'analysis.jobVersion'),
    answerVersion: asNonNegativeInt(input.answerVersion, 'analysis.answerVersion'),
    requirements,
    proposals,
    questions,
  };
}

export const RequirementStatusSchema = { parse: parseRequirementStatus };
export const RequirementSchema = { parse: parseRequirement };
export const AnalysisEnvelopeSchema = { parse: parseAnalysisEnvelope };
