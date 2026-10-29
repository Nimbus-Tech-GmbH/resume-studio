import type {
  AiErrorCode,
  AnalysisEnvelope,
  TailoringMessage,
} from '@resume-studio/ai';
import type { CmsResume, JsonResume } from '@resume-studio/transformer';
import type {
  CmsIdMap,
  EditorIdentityState,
  JsonBufferState,
  WorkspaceLoadState,
} from '@/state/editorStore';
import type { ThemeId } from '@resume-studio/themes';
import type {
  AppliedAiTransaction,
  ChangeDecision,
  ConnectionProfile,
} from '@/features/ai-tailoring/state/tailoringStore';

export interface PersistedEditorState {
  resume: JsonResume;
  original: JsonResume;
  originalCms: CmsResume | null;
  cmsIds: CmsIdMap;
  originalCmsIds: CmsIdMap;
  theme: ThemeId;
  resumeId: string | null;
  documentKey: string | null;
  documentRevision: number;
  loadedUpdatedAt: string | null;
  isStartup: boolean;
  workspaceLoadState: WorkspaceLoadState;
  documentEpoch: string;
  revision: number;
  editorIds: EditorIdentityState;
  jsonBuffer: JsonBufferState;
}

export interface PersistedTailoringState {
  workspaceId: string;
  jobText: string;
  jobVersion: number;
  connectionVersion: number;
  conversationVersion: number;
  status:
    | 'idle'
    | 'validating'
    | 'streaming'
    | 'validating-output'
    | 'ready'
    | 'failed'
    | 'cancelled'
    | 'interrupted'
    | 'outdated';
  errorMessage: string | null;
  errorCode: AiErrorCode | null;
  lastAnalysis: AnalysisEnvelope | null;
  changeDecisions: Record<string, ChangeDecision>;
  connection: ConnectionProfile;
  lastApplied: AppliedAiTransaction | null;
  messages: TailoringMessage[];
}

/** Fields kept only for reading records written before the Ollama-only contract. */
interface LegacyTailoringFields {
  answerVersion?: number;
  proposalDecisions?: Record<string, unknown>;
  proposalEdits?: Record<string, unknown>;
  assertions?: unknown[];
}

export interface PersistedWorkspaceRecordV1 {
  version: 1;
  scope: string;
  updatedAt: number;
  editor: PersistedEditorState;
  tailoring: Omit<
    PersistedTailoringState,
    | 'connectionVersion'
    | 'conversationVersion'
    | 'errorCode'
    | 'messages'
    | 'status'
    | 'changeDecisions'
    | 'lastAnalysis'
  > &
    LegacyTailoringFields & {
      lastAnalysis?: unknown;
      status:
        | PersistedTailoringState['status']
        | 'extracting'
        | 'comparing'
        | 'needs-language';
      connectionVersion?: number;
      conversationVersion?: number;
      errorCode?: AiErrorCode | null;
      messages?: TailoringMessage[];
      changeDecisions?: Record<string, unknown>;
    };
}

/**
 * Version 2 is also used by records written before the Ollama-only rewrite, so
 * migration must tolerate the previous tailoring fields and discard anything
 * that does not match the current contract.
 */
export type PersistedWorkspaceRecordV2Legacy = Omit<PersistedWorkspaceRecord, 'tailoring'> & {
  tailoring: Omit<PersistedTailoringState, 'lastAnalysis' | 'lastApplied' | 'changeDecisions'> &
    LegacyTailoringFields & {
      lastAnalysis?: unknown;
      lastApplied?: unknown;
      changeDecisions?: Record<string, unknown>;
    };
};

export interface PersistedWorkspaceRecord {
  version: 2;
  scope: string;
  updatedAt: number;
  editor: PersistedEditorState;
  tailoring: PersistedTailoringState;
}

export type AnyPersistedWorkspaceRecord =
  | PersistedWorkspaceRecordV1
  | PersistedWorkspaceRecordV2Legacy
  | PersistedWorkspaceRecord;
