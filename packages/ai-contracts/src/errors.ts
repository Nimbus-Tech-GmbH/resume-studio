export const AI_ERROR_CODES = [
  'CONNECTION_FAILED',
  'ORIGIN_BLOCKED',
  'AUTH_FAILED',
  'MODEL_NOT_FOUND',
  'RATE_LIMITED',
  'CONTEXT_TOO_LARGE',
  'TIMEOUT',
  'CANCELLED',
  'REFUSED',
  'INVALID_OUTPUT',
  'STALE_CONTEXT',
  'APPLY_CONFLICT',
  'STORAGE_FAILED',
  'INVALID_CONFIGURATION',
  'REQUEST_TOO_LARGE',
  'CAPABILITY_UNSUPPORTED',
] as const;

export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

export interface AiErrorPayload {
  code: AiErrorCode;
  message: string;
  retriable?: boolean;
}
