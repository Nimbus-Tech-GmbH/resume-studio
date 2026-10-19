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

export type EvidenceScope =
  | { kind: 'resume' }
  | { kind: 'work'; entryId: string }
  | { kind: 'project'; entryId: string };

export type EvidenceRef =
  | { source: 'resume'; snapshotRef: string; quote: string }
  | { source: 'userAnswer'; assertionId: string; assertionVersion: number };

export interface EvidenceQuestion {
  id: string;
  requirementIds: string[];
  text: string;
  scope: EvidenceScope;
}

export interface UserAssertion {
  id: string;
  questionId: string;
  text: string;
  version: number;
  scope: EvidenceScope;
}

export function parseEvidenceScope(input: unknown): EvidenceScope {
  if (!isObject(input)) throw new Error('Invalid scope');
  const kind = asString(input.kind, 'scope.kind');
  if (kind === 'resume') return { kind: 'resume' };
  if (kind === 'work') return { kind: 'work', entryId: asString(input.entryId, 'scope.entryId') };
  if (kind === 'project') {
    return { kind: 'project', entryId: asString(input.entryId, 'scope.entryId') };
  }
  throw new Error('Invalid scope.kind');
}

export function parseEvidenceRef(input: unknown): EvidenceRef {
  if (!isObject(input)) throw new Error('Invalid evidence ref');
  const source = asString(input.source, 'evidence.source');
  if (source === 'resume') {
    return {
      source: 'resume',
      snapshotRef: asString(input.snapshotRef, 'evidence.snapshotRef'),
      quote: asString(input.quote, 'evidence.quote'),
    };
  }
  if (source === 'userAnswer') {
    return {
      source: 'userAnswer',
      assertionId: asString(input.assertionId, 'evidence.assertionId'),
      assertionVersion: asNonNegativeInt(input.assertionVersion, 'evidence.assertionVersion'),
    };
  }
  throw new Error('Invalid evidence.source');
}

export function parseEvidenceQuestion(input: unknown): EvidenceQuestion {
  if (!isObject(input)) throw new Error('Invalid question');
  const requirementIds = Array.isArray(input.requirementIds)
    ? input.requirementIds.map((item, index) => asString(item, `question.requirementIds[${index}]`))
    : [];
  if (requirementIds.length === 0) throw new Error('Invalid question.requirementIds');

  return {
    id: asString(input.id, 'question.id'),
    requirementIds,
    text: asString(input.text, 'question.text'),
    scope: parseEvidenceScope(input.scope),
  };
}

export function parseUserAssertion(input: unknown): UserAssertion {
  if (!isObject(input)) throw new Error('Invalid assertion');
  return {
    id: asString(input.id, 'assertion.id'),
    questionId: asString(input.questionId, 'assertion.questionId'),
    text: asString(input.text, 'assertion.text'),
    version: asNonNegativeInt(input.version, 'assertion.version'),
    scope: parseEvidenceScope(input.scope),
  };
}

export const EvidenceScopeSchema = { parse: parseEvidenceScope };
export const EvidenceRefSchema = { parse: parseEvidenceRef };
export const EvidenceQuestionSchema = { parse: parseEvidenceQuestion };
export const UserAssertionSchema = { parse: parseUserAssertion };
