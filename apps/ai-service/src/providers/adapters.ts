import type {
  AnalysisEnvelope,
  ConnectionResult,
  EvidenceQuestion,
  EvidenceRef,
  HighlightParent,
  Proposal,
  Requirement,
  TextTarget,
} from '@resume-studio/ai-contracts';

export interface TailoringSnapshot {
  projection: {
    summary?: string;
    work: Array<{
      entryId: string;
      summary?: string;
      highlights: Array<{ highlightId: string; value: string }>;
    }>;
    projects: Array<{
      entryId: string;
      description?: string;
      highlights: Array<{ highlightId: string; value: string }>;
    }>;
  };
  snapshotHash: string;
}

export interface ProviderRuntime {
  providerId: 'openai-compatible' | 'ollama' | 'mock';
  destination: 'local' | 'cloud';
  endpoint: string;
  model: string;
  apiKey: string;
}

export interface AnalyzeInput {
  workspaceId: string;
  documentEpoch: string;
  baseRevision: number;
  jobVersion: number;
  answerVersion: number;
  jobText: string;
  snapshot: TailoringSnapshot;
}

export interface ProviderAdapter {
  testConnection(config: ProviderRuntime, signal: AbortSignal): Promise<ConnectionResult>;
  analyze(input: AnalyzeInput, config: ProviderRuntime, signal: AbortSignal): Promise<AnalysisEnvelope>;
}

type GeneratedDraft = {
  requirements?: Array<{
    id?: string;
    text?: string;
    jobQuote?: string;
    importance?: 'high' | 'medium' | 'low';
    status?: 'supported' | 'partial' | 'not-evidenced' | 'unclear';
  }>;
  proposals?: Array<{
    requirementIds?: string[];
    evidence?: Array<{
      snapshotRef?: string;
      quote?: string;
    }>;
    rationale?: string;
    action?: {
      kind?: 'setText' | 'appendHighlight';
      targetRef?: string;
      value?: string;
    };
  }>;
  questions?: Array<{
    requirementIds?: string[];
    text?: string;
    scope?: 'resume' | 'work' | 'project';
    entryId?: string;
  }>;
};

interface TextTargetManifestRow {
  ref: string;
  target: TextTarget;
  expected: {
    exists: boolean;
    value: string | null;
  };
}

interface AppendParentManifestRow {
  ref: string;
  parent: HighlightParent;
  expectedHighlightsHash: string;
}

function isObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function asInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function parseSnapshot(input: unknown): TailoringSnapshot {
  if (!isObject(input)) throw new Error('Invalid snapshot');
  if (!isObject(input.projection)) throw new Error('Invalid snapshot.projection');
  const projection = input.projection;

  const work = Array.isArray(projection.work)
    ? projection.work.map((entry, index) => {
        if (!isObject(entry)) throw new Error(`Invalid snapshot.work[${index}]`);
        const highlights = Array.isArray(entry.highlights)
          ? entry.highlights.map((item, itemIndex) => {
              if (!isObject(item)) {
                throw new Error(`Invalid snapshot.work[${index}].highlights[${itemIndex}]`);
              }
              return {
                highlightId: asString(item.highlightId, 'snapshot.work.highlightId'),
                value: typeof item.value === 'string' ? item.value : '',
              };
            })
          : [];

        return {
          entryId: asString(entry.entryId, 'snapshot.work.entryId'),
          summary: typeof entry.summary === 'string' ? entry.summary : undefined,
          highlights,
        };
      })
    : [];

  const projects = Array.isArray(projection.projects)
    ? projection.projects.map((entry, index) => {
        if (!isObject(entry)) throw new Error(`Invalid snapshot.projects[${index}]`);
        const highlights = Array.isArray(entry.highlights)
          ? entry.highlights.map((item, itemIndex) => {
              if (!isObject(item)) {
                throw new Error(`Invalid snapshot.projects[${index}].highlights[${itemIndex}]`);
              }
              return {
                highlightId: asString(item.highlightId, 'snapshot.projects.highlightId'),
                value: typeof item.value === 'string' ? item.value : '',
              };
            })
          : [];

        return {
          entryId: asString(entry.entryId, 'snapshot.projects.entryId'),
          description: typeof entry.description === 'string' ? entry.description : undefined,
          highlights,
        };
      })
    : [];

  return {
    projection: {
      summary: typeof projection.summary === 'string' ? projection.summary : undefined,
      work,
      projects,
    },
    snapshotHash: asString(input.snapshotHash, 'snapshot.snapshotHash'),
  };
}

function parseAnalyzeInput(input: unknown): AnalyzeInput {
  if (!isObject(input)) throw new Error('Invalid analyze input');
  return {
    workspaceId: asString(input.workspaceId, 'workspaceId'),
    documentEpoch: asString(input.documentEpoch, 'documentEpoch'),
    baseRevision: asInt(input.baseRevision, 'baseRevision'),
    jobVersion: asInt(input.jobVersion, 'jobVersion'),
    answerVersion: asInt(input.answerVersion, 'answerVersion'),
    jobText: asString(input.jobText, 'jobText'),
    snapshot: parseSnapshot(input.snapshot),
  };
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function hash(input: string): string {
  let state = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    state ^= input.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }
  return `h${(state >>> 0).toString(16)}`;
}

function hashHighlights(values: string[]): string {
  const normalized = values.map((value) => value.trim()).join('\u241f');
  return hash(`${values.length}:${normalized}`);
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch?.[1] ?? trimmed;

  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('Model did not return a JSON object.');
  }

  return JSON.parse(candidate.slice(start, end + 1));
}

function normalizeBaseUrl(config: ProviderRuntime): string {
  const base = config.endpoint.replace(/\/+$/, '');
  if (config.providerId === 'ollama') {
    if (base.endsWith('/v1')) return base;
    return `${base}/v1`;
  }
  return base;
}

function textTargetManifest(snapshot: TailoringSnapshot): TextTargetManifestRow[] {
  const rows: TextTargetManifestRow[] = [];

  rows.push({
    ref: 'text:resumeSummary',
    target: { kind: 'resumeSummary' },
    expected: {
      exists: snapshot.projection.summary !== undefined,
      value: snapshot.projection.summary ?? null,
    },
  });

  for (const work of snapshot.projection.work) {
    rows.push({
      ref: `text:workSummary:${work.entryId}`,
      target: { kind: 'workSummary', entryId: work.entryId },
      expected: {
        exists: work.summary !== undefined,
        value: work.summary ?? null,
      },
    });

    for (const highlight of work.highlights) {
      rows.push({
        ref: `text:workHighlight:${work.entryId}:${highlight.highlightId}`,
        target: {
          kind: 'workHighlight',
          entryId: work.entryId,
          highlightId: highlight.highlightId,
        },
        expected: {
          exists: true,
          value: highlight.value,
        },
      });
    }
  }

  for (const project of snapshot.projection.projects) {
    rows.push({
      ref: `text:projectDescription:${project.entryId}`,
      target: { kind: 'projectDescription', entryId: project.entryId },
      expected: {
        exists: project.description !== undefined,
        value: project.description ?? null,
      },
    });

    for (const highlight of project.highlights) {
      rows.push({
        ref: `text:projectHighlight:${project.entryId}:${highlight.highlightId}`,
        target: {
          kind: 'projectHighlight',
          entryId: project.entryId,
          highlightId: highlight.highlightId,
        },
        expected: {
          exists: true,
          value: highlight.value,
        },
      });
    }
  }

  return rows;
}

function appendParentManifest(snapshot: TailoringSnapshot): AppendParentManifestRow[] {
  const rows: AppendParentManifestRow[] = [];

  for (const work of snapshot.projection.work) {
    rows.push({
      ref: `append:work:${work.entryId}`,
      parent: { kind: 'work', entryId: work.entryId },
      expectedHighlightsHash: hashHighlights(work.highlights.map((row) => row.value)),
    });
  }

  for (const project of snapshot.projection.projects) {
    rows.push({
      ref: `append:project:${project.entryId}`,
      parent: { kind: 'project', entryId: project.entryId },
      expectedHighlightsHash: hashHighlights(project.highlights.map((row) => row.value)),
    });
  }

  return rows;
}

function normalizeRequirements(raw: GeneratedDraft['requirements']): Requirement[] {
  const rows = Array.isArray(raw) ? raw : [];
  const out: Requirement[] = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row || typeof row.text !== 'string' || row.text.trim().length === 0) continue;
    if (typeof row.jobQuote !== 'string' || row.jobQuote.trim().length === 0) continue;

    const importance =
      row.importance === 'high' || row.importance === 'medium' || row.importance === 'low'
        ? row.importance
        : 'medium';

    const status =
      row.status === 'supported' ||
      row.status === 'partial' ||
      row.status === 'not-evidenced' ||
      row.status === 'unclear'
        ? row.status
        : 'unclear';

    out.push({
      id: typeof row.id === 'string' && row.id.trim().length > 0 ? row.id : `req-${index + 1}`,
      text: row.text.trim(),
      jobQuote: row.jobQuote.trim(),
      importance,
      status,
    });
  }

  return out;
}

function normalizeQuestions(
  raw: GeneratedDraft['questions'],
  requirements: Requirement[],
): EvidenceQuestion[] {
  const requirementIds = new Set(requirements.map((item) => item.id));
  const rows = Array.isArray(raw) ? raw : [];
  const out: EvidenceQuestion[] = [];

  for (const row of rows) {
    if (!row || typeof row.text !== 'string' || row.text.trim().length === 0) continue;

    const linked = (Array.isArray(row.requirementIds) ? row.requirementIds : []).filter((id) =>
      requirementIds.has(id),
    );

    if (linked.length === 0) continue;

    const scope =
      row.scope === 'work' && typeof row.entryId === 'string' && row.entryId.trim().length > 0
        ? { kind: 'work' as const, entryId: row.entryId.trim() }
        : row.scope === 'project' && typeof row.entryId === 'string' && row.entryId.trim().length > 0
          ? { kind: 'project' as const, entryId: row.entryId.trim() }
          : { kind: 'resume' as const };

    out.push({
      id: randomId(),
      requirementIds: linked,
      text: row.text.trim(),
      scope,
    });
  }

  return out;
}

function normalizeEvidence(raw: unknown): EvidenceRef[] {
  if (!Array.isArray(raw)) return [];
  const out: EvidenceRef[] = [];
  for (const item of raw) {
    if (!isObject(item)) continue;
    if (typeof item.snapshotRef !== 'string' || item.snapshotRef.trim().length === 0) continue;
    if (typeof item.quote !== 'string' || item.quote.trim().length === 0) continue;
    out.push({
      source: 'resume',
      snapshotRef: item.snapshotRef.trim(),
      quote: item.quote.trim(),
    });
  }
  return out;
}

function normalizeProposals(
  raw: GeneratedDraft['proposals'],
  requirements: Requirement[],
  textTargets: TextTargetManifestRow[],
  appendParents: AppendParentManifestRow[],
): Proposal[] {
  const requirementIds = new Set(requirements.map((item) => item.id));
  const textMap = new Map(textTargets.map((row) => [row.ref, row]));
  const appendMap = new Map(appendParents.map((row) => [row.ref, row]));
  const rows = Array.isArray(raw) ? raw : [];

  const out: Proposal[] = [];

  for (const row of rows) {
    if (!row || !isObject(row.action)) continue;

    const linked = (Array.isArray(row.requirementIds) ? row.requirementIds : []).filter((id) =>
      requirementIds.has(id),
    );
    if (linked.length === 0) continue;

    const value = typeof row.action.value === 'string' ? row.action.value.trim() : '';
    if (!value) continue;

    const rationale = typeof row.rationale === 'string' && row.rationale.trim().length > 0
      ? row.rationale.trim()
      : 'Tailoring proposal generated from provided resume evidence.';

    const evidence = normalizeEvidence(row.evidence);
    if (evidence.length === 0) continue;

    if (row.action.kind === 'setText' && typeof row.action.targetRef === 'string') {
      const target = textMap.get(row.action.targetRef);
      if (!target) continue;

      out.push({
        id: randomId(),
        operation: {
          kind: 'setText',
          target: target.target,
          expected: target.expected,
          value,
        },
        requirementIds: linked,
        evidence,
        rationale,
      });
      continue;
    }

    if (row.action.kind === 'appendHighlight' && typeof row.action.targetRef === 'string') {
      const parent = appendMap.get(row.action.targetRef);
      if (!parent) continue;

      out.push({
        id: randomId(),
        operation: {
          kind: 'appendHighlight',
          parent: parent.parent,
          expectedHighlightsHash: parent.expectedHighlightsHash,
          value,
        },
        requirementIds: linked,
        evidence,
        rationale,
      });
    }
  }

  return out;
}

async function loadAiSdk(): Promise<{
  generateText: (input: {
    model: unknown;
    prompt: string;
    maxTokens?: number;
    temperature?: number;
    abortSignal?: AbortSignal;
  }) => Promise<{ text: string }>;
  createOpenAI: (config: { apiKey?: string; baseURL?: string }) => (modelId: string) => unknown;
}> {
  const aiModuleName = 'ai';
  const openAiModuleName = '@ai-sdk/openai';

  const [{ generateText }, { createOpenAI }] = await Promise.all([
    import(aiModuleName),
    import(openAiModuleName),
  ]);

  return {
    generateText,
    createOpenAI,
  };
}

async function generateWithAiSdk(
  config: ProviderRuntime,
  prompt: string,
  signal: AbortSignal,
  maxTokens: number,
): Promise<string> {
  const { generateText, createOpenAI } = await loadAiSdk();

  const modelFactory = createOpenAI({
    apiKey: config.apiKey || undefined,
    baseURL: normalizeBaseUrl(config),
  });

  const result = await generateText({
    model: modelFactory(config.model),
    prompt,
    maxTokens,
    temperature: 0,
    abortSignal: signal,
  });

  return result.text;
}

function buildAnalysisPrompt(input: AnalyzeInput): string {
  const textTargets = textTargetManifest(input.snapshot);
  const appendParents = appendParentManifest(input.snapshot);

  return [
    'You are an expert resume tailoring assistant.',
    'You must return ONLY valid JSON with keys: requirements, proposals, questions.',
    'Never invent candidate evidence. Use only provided resume snapshot text as evidence quotes.',
    'Allowed proposal action kinds: setText, appendHighlight.',
    'For setText use a targetRef from textTargets.',
    'For appendHighlight use a targetRef from appendParents.',
    '',
    'jobDescription:',
    input.jobText,
    '',
    'resumeSnapshot:',
    JSON.stringify(input.snapshot.projection),
    '',
    'textTargets:',
    JSON.stringify(textTargets),
    '',
    'appendParents:',
    JSON.stringify(appendParents),
    '',
    'Output shape exactly:',
    JSON.stringify({
      requirements: [
        {
          id: 'req-1',
          text: 'string',
          jobQuote: 'string',
          importance: 'high',
          status: 'supported',
        },
      ],
      proposals: [
        {
          requirementIds: ['req-1'],
          evidence: [
            {
              snapshotRef: 'work:entry-id:summary',
              quote: 'exact quote from snapshot',
            },
          ],
          rationale: 'short rationale',
          action: {
            kind: 'appendHighlight',
            targetRef: 'append:work:entry-id',
            value: 'proposal text',
          },
        },
      ],
      questions: [
        {
          requirementIds: ['req-1'],
          text: 'question text',
          scope: 'resume',
        },
      ],
    }),
  ].join('\n');
}

function runMockAnalysis(inputRaw: AnalyzeInput): AnalysisEnvelope {
  const input = parseAnalyzeInput(inputRaw);

  return {
    schemaVersion: 1,
    analysisId: randomId(),
    workspaceId: input.workspaceId,
    documentEpoch: input.documentEpoch,
    baseRevision: input.baseRevision,
    snapshotHash: input.snapshot.snapshotHash,
    jobVersion: input.jobVersion,
    answerVersion: input.answerVersion,
    requirements: [],
    proposals: [],
    questions: [
      {
        id: randomId(),
        requirementIds: ['req-1'],
        text: 'Mock mode: switch provider to openai-compatible and run analysis again.',
        scope: { kind: 'resume' },
      },
    ],
  };
}

async function runAiSdkAnalysis(inputRaw: AnalyzeInput, config: ProviderRuntime, signal: AbortSignal): Promise<AnalysisEnvelope> {
  const input = parseAnalyzeInput(inputRaw);
  const textTargets = textTargetManifest(input.snapshot);
  const appendParents = appendParentManifest(input.snapshot);

  const prompt = buildAnalysisPrompt(input);
  const raw = await generateWithAiSdk(config, prompt, signal, 2400);
  const parsed = extractJsonObject(raw) as GeneratedDraft;

  const requirements = normalizeRequirements(parsed.requirements);
  const proposals = normalizeProposals(
    parsed.proposals,
    requirements,
    textTargets,
    appendParents,
  );
  const questions = normalizeQuestions(parsed.questions, requirements);

  return {
    schemaVersion: 1,
    analysisId: randomId(),
    workspaceId: input.workspaceId,
    documentEpoch: input.documentEpoch,
    baseRevision: input.baseRevision,
    snapshotHash: input.snapshot.snapshotHash,
    jobVersion: input.jobVersion,
    answerVersion: input.answerVersion,
    requirements,
    proposals,
    questions,
  };
}

async function runAiSdkPing(config: ProviderRuntime, signal: AbortSignal): Promise<void> {
  const prompt = 'Reply with exactly: OK';
  const text = await generateWithAiSdk(config, prompt, signal, 8);
  if (!text || text.trim().length === 0) {
    throw new Error('Empty model response');
  }
}

const mockAdapter: ProviderAdapter = {
  async testConnection() {
    return { ok: true, latencyMs: 0 };
  },
  async analyze(input) {
    return runMockAnalysis(input);
  },
};

const openAiCompatibleAdapter: ProviderAdapter = {
  async testConnection(config, signal) {
    if (!config.apiKey) {
      return { ok: false, code: 'AUTH_FAILED', message: 'Missing API key.' };
    }

    try {
      await runAiSdkPing(config, signal);
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        code: /401|403|unauthoriz|auth|api key/i.test(message)
          ? 'AUTH_FAILED'
          : 'CONNECTION_FAILED',
        message,
      };
    }
  },
  async analyze(input, config, signal) {
    return runAiSdkAnalysis(input, config, signal);
  },
};

const ollamaAdapter: ProviderAdapter = {
  async testConnection(config, signal) {
    try {
      await runAiSdkPing(config, signal);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        code: 'CONNECTION_FAILED',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },
  async analyze(input, config, signal) {
    return runAiSdkAnalysis(input, config, signal);
  },
};

export function adapterFor(providerId: ProviderRuntime['providerId']): ProviderAdapter {
  if (providerId === 'openai-compatible') return openAiCompatibleAdapter;
  if (providerId === 'ollama') return ollamaAdapter;
  return mockAdapter;
}
