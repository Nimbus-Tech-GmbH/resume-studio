import type { AnalysisEnvelope, ProposalDecision } from '@resume-studio/ai-contracts';
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
  answerVersion: number;
  status:
    | 'idle'
    | 'extracting'
    | 'comparing'
    | 'ready'
    | 'needs-language'
    | 'failed'
    | 'cancelled'
    | 'interrupted'
    | 'outdated';
  errorMessage: string | null;
  lastAnalysis: AnalysisEnvelope | null;
  proposalDecisions: Record<string, ProposalDecision>;
  proposalEdits: Record<string, string>;
  connection: ConnectionProfile;
  lastApplied: AppliedAiTransaction | null;
}

export interface PersistedWorkspaceRecord {
  version: 1;
  scope: string;
  updatedAt: number;
  editor: PersistedEditorState;
  tailoring: PersistedTailoringState;
}
