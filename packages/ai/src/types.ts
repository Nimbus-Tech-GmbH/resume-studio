/**
 * Public contracts for the local Ollama tailoring feature.
 *
 * The shapes here are deliberately independent from the web editor and CMS.
 * A change carries enough source information to be accepted or rejected on
 * its own, and the group id lets the UI accept related edits together.
 */

export const CHANGE_TYPES = [
  'rewrite-summary',
  'rewrite-work-summary',
  'rewrite-work-description',
  'rewrite-work-highlight',
  'rewrite-project-description',
  'rewrite-project-highlight',
  'narrow-label',
  'reorder-skills',
  'delete-work-highlight',
  'delete-project-highlight',
] as const;

export type ChangeType = (typeof CHANGE_TYPES)[number];

export type ChangeOperation = 'rewrite' | 'reorder' | 'delete' | 'narrow';

export interface TailoringChange {
  /** Stable identifier, unique within one model response. */
  id: string;
  /** Changes that must be accepted or rejected together. */
  group: string;
  type: ChangeType;
  /** Top-level JSON Resume section: basics, work, projects, or skills. */
  section: string;
  /** Human-readable entity, for example "Acme — Senior Engineer". */
  entity: string;
  /** Short, human-readable explanation of the edit. */
  summary: string;
  /** JSON Pointer into the source resume. */
  path: string;
  op: ChangeOperation;
  before: unknown;
  after: unknown;
  /** JSON Pointers that support newly introduced terms or numbers. */
  evidence: string[];
}

export interface TailoringGap {
  id: string;
  /** Job-description requirement or keyword the resume does not demonstrate. */
  requirement: string;
  /** Human-readable explanation of the gap. */
  explanation: string;
  /** Why the gap cannot be filled from existing resume evidence. */
  reason: string;
}

export interface TailoredResumeResponse {
  resume: Record<string, unknown>;
  changes: TailoringChange[];
  gaps: TailoringGap[];
}

export interface ChangeGroup {
  id: string;
  label: string;
  section: string;
  changes: TailoringChange[];
}

export interface TailoringAnalysis {
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

/** Backwards-compatible name used by the web workspace recovery layer. */
export type AnalysisEnvelope = TailoringAnalysis;

export const PROVIDER_IDS = ['ollama', 'opencode'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export function parseProviderId(input: unknown): ProviderId {
  if (input === 'ollama' || input === 'opencode') return input;
  throw new Error('Invalid providerId');
}

export function parseLiveProviderId(input: unknown): ProviderId {
  return parseProviderId(input);
}

export function isConnectionConfigured(profile: ConnectionProfile): boolean {
  const credentialReady =
    profile.providerId === 'ollama' || Boolean(profile.apiKey?.trim());
  return (
    credentialReady &&
    PROVIDER_IDS.includes(profile.providerId) &&
    profile.model.trim().length > 0 &&
    profile.endpoint.trim().length > 0 &&
    profile.contextTokens > 0 &&
    profile.maxOutputTokens > 0 &&
    profile.maxOutputTokens < profile.contextTokens
  );
}


export interface ConnectionProfile {
  id: string;
  providerId: ProviderId;
  destination: 'local' | 'remote';
  endpoint: string;
  model: string;
  /** Optional OpenCode API key. Never persisted. */
  apiKey?: string;
  contextTokens: number;
  maxOutputTokens: number;
}

export interface ConnectionResult {
  ok: boolean;
  code?: string;
  message?: string;
  latencyMs?: number;
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

export type AiErrorCode =
  | 'CONNECTION_FAILED'
  | 'ORIGIN_BLOCKED'
  | 'AUTH_FAILED'
  | 'MODEL_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'CONTEXT_TOO_LARGE'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'REFUSED'
  | 'INVALID_OUTPUT'
  | 'INVALID_RESUME'
  | 'STALE_CONTEXT'
  | 'APPLY_CONFLICT'
  | 'STORAGE_FAILED'
  | 'INVALID_CONFIGURATION'
  | 'REQUEST_TOO_LARGE'
  | 'CAPABILITY_UNSUPPORTED'
  | 'MCP_UNAVAILABLE'
  | 'MCP_UNAUTHORIZED';

export type TailoringMessageStatus = 'complete' | 'streaming' | 'interrupted' | 'failed';

export interface TailoringMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: TailoringMessageStatus;
  requestId: string | null;
}

export type TailoringEvent =
  | { type: 'assistant-text'; requestId: string; text: string }
  | { type: 'analysis'; requestId: string; analysis: TailoringAnalysis }
  | { type: 'complete'; requestId: string }
  | { type: 'error'; requestId: string; code: AiErrorCode; message: string };

export interface McpToolResult {
  tool: string;
  content: unknown;
}

export interface McpOptions {
  enabled: boolean;
  accessToken?: string;
}
