import { create } from 'zustand';
import type {
  AnalysisEnvelope,
  ProposalDecision,
  ProviderId,
} from '@resume-studio/ai-contracts';

export type AnalysisStatus =
  | 'idle'
  | 'extracting'
  | 'comparing'
  | 'ready'
  | 'needs-language'
  | 'failed'
  | 'cancelled'
  | 'interrupted'
  | 'outdated';

export interface ConnectionProfile {
  providerId: ProviderId;
  destination: 'local' | 'cloud';
  model: string;
  endpoint: string;
  label: string;
}

export interface AppliedSetTextChange {
  kind: 'setText';
  target: string;
  existedBefore: boolean;
  beforeValue: string | null;
  afterValue: string;
}

export interface AppliedAppendHighlightChange {
  kind: 'appendHighlight';
  parent: string;
  createdHighlightId: string;
  value: string;
}

export interface AppliedAiTransaction {
  id: string;
  analysisId: string;
  documentEpoch: string;
  changeSet: Array<AppliedSetTextChange | AppliedAppendHighlightChange>;
}

interface TailoringState {
  panelOpen: boolean;
  workspaceId: string;
  jobText: string;
  jobVersion: number;
  answerVersion: number;
  status: AnalysisStatus;
  errorMessage: string | null;
  lastAnalysis: AnalysisEnvelope | null;
  proposalDecisions: Record<string, ProposalDecision>;
  proposalEdits: Record<string, string>;
  connection: ConnectionProfile;
  lastApplied: AppliedAiTransaction | null;

  setPanelOpen: (open: boolean) => void;
  setJobText: (next: string) => void;
  setConnection: (next: Partial<ConnectionProfile>) => void;
  setStatus: (status: AnalysisStatus, errorMessage?: string | null) => void;
  setAnalysis: (analysis: AnalysisEnvelope) => void;
  setProposalDecision: (proposalId: string, decision: ProposalDecision) => void;
  setProposalEdit: (proposalId: string, value: string) => void;
  setLastApplied: (tx: AppliedAiTransaction | null) => void;
  clearAll: () => void;
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

const DEFAULT_CONNECTION: ConnectionProfile = {
  providerId: 'openai-compatible',
  destination: 'cloud',
  model: 'gpt-4o-mini',
  endpoint: 'https://api.openai.com/v1',
  label: 'OpenAI-compatible',
};

function blankState(workspaceId: string): Omit<TailoringState, 'setPanelOpen' | 'setJobText' | 'setConnection' | 'setStatus' | 'setAnalysis' | 'setProposalDecision' | 'setProposalEdit' | 'setLastApplied' | 'clearAll'> {
  return {
    panelOpen: false,
    workspaceId,
    jobText: '',
    jobVersion: 0,
    answerVersion: 0,
    status: 'idle',
    errorMessage: null,
    lastAnalysis: null,
    proposalDecisions: {},
    proposalEdits: {},
    connection: DEFAULT_CONNECTION,
    lastApplied: null,
  };
}

export const useTailoringStore = create<TailoringState>()((set) => ({
  ...blankState(randomId()),

  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setJobText: (jobText) =>
    set((prev) => {
      const changed = jobText !== prev.jobText;
      if (!changed) return { jobText };
      return {
        jobText,
        jobVersion: prev.jobVersion + 1,
        status: prev.lastAnalysis ? 'outdated' : prev.status,
      };
    }),
  setConnection: (next) =>
    set((prev) => ({
      connection: {
        ...prev.connection,
        ...next,
      },
    })),
  setStatus: (status, errorMessage = null) => set({ status, errorMessage }),
  setAnalysis: (lastAnalysis) =>
    set(() => {
      const proposalDecisions: Record<string, ProposalDecision> = {};
      const proposalEdits: Record<string, string> = {};
      for (const proposal of lastAnalysis.proposals) {
        proposalDecisions[proposal.id] = 'pending';
        proposalEdits[proposal.id] =
          proposal.operation.kind === 'setText'
            ? proposal.operation.value
            : proposal.operation.value;
      }
      return {
        lastAnalysis,
        status: 'ready',
        errorMessage: null,
        proposalDecisions,
        proposalEdits,
      };
    }),
  setProposalDecision: (proposalId, decision) =>
    set((prev) => ({
      proposalDecisions: {
        ...prev.proposalDecisions,
        [proposalId]: decision,
      },
    })),
  setProposalEdit: (proposalId, value) =>
    set((prev) => ({
      proposalEdits: {
        ...prev.proposalEdits,
        [proposalId]: value,
      },
    })),
  setLastApplied: (lastApplied) => set({ lastApplied }),
  clearAll: () => set(blankState(randomId())),
}));
