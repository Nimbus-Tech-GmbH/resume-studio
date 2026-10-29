import { create } from 'zustand';
import type {
  AiErrorCode,
  AnalysisEnvelope,
  ConnectionProfile,
  TailoringMessage,
} from '@resume-studio/ai';
import { groupChanges, isConnectionConfigured } from '@resume-studio/ai';
import type { JsonResume } from '@resume-studio/transformer';
import type { EditorIdentityState } from '@/state/editorStore';
import { migrateConnectionProfile, providerPreset } from '../connections/providers';

export type AnalysisStatus =
  | 'idle'
  | 'validating'
  | 'streaming'
  | 'validating-output'
  | 'ready'
  | 'failed'
  | 'cancelled'
  | 'interrupted'
  | 'outdated';

export type ChangeDecision = 'pending' | 'selected' | 'rejected' | 'applied';

export interface AppliedAiTransaction {
  id: string;
  analysisId: string;
  documentEpoch: string;
  baseRevision: number;
  beforeResume: JsonResume;
  beforeEditorIds: EditorIdentityState;
  afterHash: string;
}

interface TailoringState {
  panelOpen: boolean;
  workspaceId: string;
  jobText: string;
  jobVersion: number;
  connectionVersion: number;
  conversationVersion: number;
  status: AnalysisStatus;
  errorMessage: string | null;
  errorCode: AiErrorCode | null;
  lastAnalysis: AnalysisEnvelope | null;
  changeDecisions: Record<string, ChangeDecision>;
  connection: ConnectionProfile;
  lastApplied: AppliedAiTransaction | null;
  messages: TailoringMessage[];
  activeRequestId: string | null;
  streamingAssistantText: string;

  setPanelOpen: (open: boolean) => void;
  setJobText: (next: string) => void;
  setConnection: (next: Partial<ConnectionProfile>) => void;
  replaceConnection: (next: ConnectionProfile) => void;
  setStatus: (
    status: AnalysisStatus,
    errorMessage?: string | null,
    errorCode?: AiErrorCode | null,
  ) => void;
  setAnalysis: (analysis: AnalysisEnvelope) => void;
  setChangeDecision: (groupId: string, decision: ChangeDecision) => void;
  setAllChangeDecisions: (decision: ChangeDecision) => void;
  setLastApplied: (tx: AppliedAiTransaction | null) => void;
  appendUserMessage: (content: string) => string;
  beginRequest: (requestId: string, userMessageId: string) => void;
  updateStreamingText: (requestId: string, text: string) => void;
  completeAssistantMessage: (requestId: string, text: string) => void;
  failRequest: (requestId: string, message: string, code?: AiErrorCode | null) => void;
  cancelRequest: (requestId: string) => void;
  interruptActiveRequest: () => void;
  hydrateFromRecovery: (partial: Partial<TailoringState>) => void;
  clearAll: () => void;
  canGenerate: () => boolean;
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

const DEFAULT_CONNECTION: ConnectionProfile = providerPreset('ollama');

type Blank = Omit<
  TailoringState,
  | 'setPanelOpen'
  | 'setJobText'
  | 'setConnection'
  | 'replaceConnection'
  | 'setStatus'
  | 'setAnalysis'
  | 'setChangeDecision'
  | 'setAllChangeDecisions'
  | 'setLastApplied'
  | 'appendUserMessage'
  | 'beginRequest'
  | 'updateStreamingText'
  | 'completeAssistantMessage'
  | 'failRequest'
  | 'cancelRequest'
  | 'interruptActiveRequest'
  | 'hydrateFromRecovery'
  | 'clearAll'
  | 'canGenerate'
>;

function blankState(workspaceId: string): Blank {
  return {
    panelOpen: false,
    workspaceId,
    jobText: '',
    jobVersion: 0,
    connectionVersion: 0,
    conversationVersion: 0,
    status: 'idle',
    errorMessage: null,
    errorCode: null,
    lastAnalysis: null,
    changeDecisions: {},
    connection: DEFAULT_CONNECTION,
    lastApplied: null,
    messages: [],
    activeRequestId: null,
    streamingAssistantText: '',
  };
}

function decisionsFor(analysis: AnalysisEnvelope): Record<string, ChangeDecision> {
  const decisions: Record<string, ChangeDecision> = {};
  for (const group of groupChanges(analysis.response.changes)) {
    decisions[group.id] = 'pending';
  }
  return decisions;
}

export const useTailoringStore = create<TailoringState>()((set, get) => ({
  ...blankState(randomId()),

  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setJobText: (jobText) =>
    set((prev) => {
      const changed = jobText !== prev.jobText;
      if (!changed) return { jobText };
      return {
        jobText,
        jobVersion: prev.jobVersion + 1,
        status: prev.lastAnalysis || prev.activeRequestId ? 'outdated' : prev.status,
      };
    }),
  setConnection: (next) =>
    set((prev) => {
      const connection: ConnectionProfile = {
        ...prev.connection,
        ...next,
      };
      return {
        connection,
        connectionVersion: prev.connectionVersion + 1,
        status: prev.activeRequestId ? 'outdated' : prev.status,
      };
    }),
  replaceConnection: (connection) =>
    set((prev) => ({
      connection: migrateConnectionProfile(connection),
      connectionVersion: prev.connectionVersion + 1,
    })),
  setStatus: (status, errorMessage = null, errorCode = null) =>
    set({ status, errorMessage, errorCode }),
  setAnalysis: (lastAnalysis) =>
    set({
      lastAnalysis,
      status: 'ready',
      errorMessage: null,
      errorCode: null,
      changeDecisions: decisionsFor(lastAnalysis),
      activeRequestId: null,
      streamingAssistantText: '',
    }),
  setChangeDecision: (groupId, decision) =>
    set((prev) => ({
      changeDecisions: { ...prev.changeDecisions, [groupId]: decision },
    })),
  setAllChangeDecisions: (decision) =>
    set((prev) => {
      if (!prev.lastAnalysis) return prev;
      const changeDecisions: Record<string, ChangeDecision> = {};
      for (const group of groupChanges(prev.lastAnalysis.response.changes)) {
        changeDecisions[group.id] = decision;
      }
      return { changeDecisions };
    }),
  setLastApplied: (lastApplied) => set({ lastApplied }),
  appendUserMessage: (content) => {
    const id = randomId();
    set((prev) => ({
      messages: [
        ...prev.messages,
        {
          id,
          role: 'user',
          content,
          status: 'complete',
          requestId: null,
        },
      ],
      conversationVersion: prev.conversationVersion + 1,
    }));
    return id;
  },
  beginRequest: (requestId, _userMessageId) =>
    set((prev) => ({
      activeRequestId: requestId,
      status: 'streaming',
      errorMessage: null,
      errorCode: null,
      streamingAssistantText: '',
      messages: [
        ...prev.messages,
        {
          id: randomId(),
          role: 'assistant',
          content: '',
          status: 'streaming',
          requestId,
        },
      ],
    })),
  updateStreamingText: (requestId, text) =>
    set((prev) => {
      if (prev.activeRequestId !== requestId) return prev;
      return {
        streamingAssistantText: text,
        messages: prev.messages.map((message) =>
          message.requestId === requestId && message.role === 'assistant'
            ? { ...message, content: text, status: 'streaming' }
            : message,
        ),
      };
    }),
  completeAssistantMessage: (requestId, text) =>
    set((prev) => {
      if (prev.activeRequestId !== requestId) return prev;
      return {
        streamingAssistantText: '',
        messages: prev.messages.map((message) =>
          message.requestId === requestId && message.role === 'assistant'
            ? { ...message, content: text, status: 'complete' }
            : message,
        ),
      };
    }),
  failRequest: (requestId, message, code = 'INVALID_OUTPUT') =>
    set((prev) => {
      if (prev.activeRequestId !== requestId) return prev;
      const display = message.trim() || code || 'Request failed.';
      return {
        status: 'failed',
        errorMessage: display,
        errorCode: code,
        activeRequestId: null,
        streamingAssistantText: '',
        messages: prev.messages.map((row) =>
          row.requestId === requestId && row.role === 'assistant'
            ? {
                ...row,
                status: 'failed' as const,
                content: row.content.trim() ? row.content : `[${code}] ${display}`,
              }
            : row,
        ),
      };
    }),
  cancelRequest: (requestId) =>
    set((prev) => {
      if (prev.activeRequestId !== requestId) return prev;
      return {
        status: 'cancelled',
        activeRequestId: null,
        streamingAssistantText: '',
        messages: prev.messages.map((row) =>
          row.requestId === requestId && row.role === 'assistant'
            ? {
                ...row,
                status: 'interrupted' as const,
                content: row.content.trim() ? row.content : 'Cancelled.',
              }
            : row,
        ),
      };
    }),
  interruptActiveRequest: () =>
    set((prev) => {
      if (!prev.activeRequestId) return prev;
      const requestId = prev.activeRequestId;
      return {
        status: 'interrupted',
        activeRequestId: null,
        streamingAssistantText: '',
        messages: prev.messages.map((row) =>
          row.requestId === requestId && row.status === 'streaming'
            ? { ...row, status: 'interrupted' as const }
            : row,
        ),
      };
    }),
  hydrateFromRecovery: (partial) =>
    set((prev) => ({
      ...prev,
      ...partial,
      connection: migrateConnectionProfile(partial.connection ?? prev.connection),
      panelOpen: false,
      activeRequestId: null,
      streamingAssistantText: '',
    })),
  clearAll: () => set(blankState(randomId())),
  canGenerate: () => {
    const state = get();
    return (
      isConnectionConfigured(state.connection) &&
      state.jobText.trim().length > 0 &&
      state.activeRequestId === null
    );
  },
}));

export type { ConnectionProfile };
