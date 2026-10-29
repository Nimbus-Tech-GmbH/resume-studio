function isObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function asOptionalStringOrNull(value: unknown, field: string): string | null {
  if (value === null) return null;
  return asString(value, field);
}

export type TailoringMessageStatus =
  | 'complete'
  | 'streaming'
  | 'interrupted'
  | 'failed';

export interface TailoringMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: TailoringMessageStatus;
  requestId: string | null;
}

export interface TailoringRequestIdentity {
  requestId: string;
  workspaceId: string;
  documentEpoch: string;
  baseRevision: number;
  snapshotHash: string;
  jobVersion: number;
  connectionVersion: number;
  conversationVersion: number;
}

function parseMessageStatus(input: unknown): TailoringMessageStatus {
  const status = asString(input, 'message.status');
  if (
    status === 'complete' ||
    status === 'streaming' ||
    status === 'interrupted' ||
    status === 'failed'
  ) {
    return status;
  }
  throw new Error('Invalid message.status');
}

export function parseTailoringMessage(input: unknown): TailoringMessage {
  if (!isObject(input)) throw new Error('Invalid message');
  const role = asString(input.role, 'message.role');
  if (role !== 'user' && role !== 'assistant') {
    throw new Error('Invalid message.role');
  }
  return {
    id: asString(input.id, 'message.id'),
    role,
    content: typeof input.content === 'string' ? input.content : '',
    status: parseMessageStatus(input.status),
    requestId: asOptionalStringOrNull(input.requestId, 'message.requestId'),
  };
}

function asNonNegativeInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

export function parseTailoringRequestIdentity(input: unknown): TailoringRequestIdentity {
  if (!isObject(input)) throw new Error('Invalid request identity');
  return {
    requestId: asString(input.requestId, 'requestId'),
    workspaceId: asString(input.workspaceId, 'workspaceId'),
    documentEpoch: asString(input.documentEpoch, 'documentEpoch'),
    baseRevision: asNonNegativeInt(input.baseRevision, 'baseRevision'),
    snapshotHash: asString(input.snapshotHash, 'snapshotHash'),
    jobVersion: asNonNegativeInt(input.jobVersion, 'jobVersion'),
    connectionVersion: asNonNegativeInt(input.connectionVersion, 'connectionVersion'),
    conversationVersion: asNonNegativeInt(input.conversationVersion, 'conversationVersion'),
  };
}

export const TailoringMessageSchema = { parse: parseTailoringMessage };
export const TailoringRequestIdentitySchema = { parse: parseTailoringRequestIdentity };
