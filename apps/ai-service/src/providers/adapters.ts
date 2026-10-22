import {
  parseProviderId,
  type AnalysisEnvelope,
  type ConnectionResult,
  type EvidenceQuestion,
  type EvidenceRef,
  type HighlightParent,
  type Proposal,
  type ProviderId,
  type Requirement,
  type TextTarget,
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
  providerId: ProviderId;
  destination: 'local' | 'cloud';
  endpoint: string;
  model: string;
  apiKey: string;
}

/** Local servers (Ollama, `fm serve`) ignore credentials but the AI SDK still
 *  demands one, so a placeholder is sent when the user supplied none. */
const LOCAL_PLACEHOLDER_KEY = 'local-no-key';

export function parseProvider(value: unknown): ProviderRuntime['providerId'] {
  return parseProviderId(value);
}

export function parseDestination(value: unknown): ProviderRuntime['destination'] {
  const destination = asString(value, 'destination');
  if (destination === 'local' || destination === 'cloud') return destination;
  throw new Error('Invalid destination');
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
    requirementId?: string;
    targetRef?: string;
    value?: string;
    quote?: string;
    snapshotRef?: string;
    rationale?: string;
  }>;
  questions?: Array<{
    requirementId?: string;
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

/**
 * Small on-device models occasionally emit slightly broken JSON: dropped
 * opening quotes on keys, stray `key":` echoes in front of a value, trailing
 * commas, or output cut off mid-string by the token limit.
 */
function closeTruncatedJson(candidate: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const char of candidate) {
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{' || char === '[') stack.push(char);
    else if (char === '}' || char === ']') stack.pop();
  }

  if (!inString && stack.length === 0) return candidate;

  let closed = candidate;
  if (inString) {
    closed += escaped ? '\\"' : '"';
  }
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    closed += stack[index] === '{' ? '}' : ']';
  }
  return closed;
}

function repairJson(candidate: string): string {
  // Quote repairs come first: they restore the string boundaries that the
  // truncation scan below depends on.
  const quoted = candidate
    .replace(/""\s+(?=")/g, '')
    .replace(/([,{[])\s*([A-Za-z_][A-Za-z0-9_]*)"\s*:/g, '$1"$2":')
    .replace(/("[^"]*"\s*:\s*)"[A-Za-z_][A-Za-z0-9_]*"\s*:\s*/g, '$1');

  return closeTruncatedJson(quoted).replace(/,\s*([}\]])/g, '$1');
}

function parseJsonLeniently(candidate: string): unknown {
  try {
    return JSON.parse(candidate);
  } catch (error) {
    const repaired = repairJson(candidate);
    if (repaired === candidate) throw error;
    return JSON.parse(repaired);
  }
}

export function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch?.[1] ?? trimmed;

  const start = candidate.indexOf('{');
  if (start < 0) {
    throw new Error('Model did not return a JSON object.');
  }

  const body = candidate.slice(start);
  // Truncated output may have no closing brace at all, so fall back to the
  // whole remainder and let the repair close the open structures.
  const end = body.lastIndexOf('}');
  return parseJsonLeniently(end > 0 ? body.slice(0, end + 1) : body);
}

function normalizeBaseUrl(config: ProviderRuntime): string {
  const base = config.endpoint.replace(/\/+$/, '');
  if (config.providerId === 'ollama' || config.providerId === 'apple-foundation-models') {
    if (base.endsWith('/v1')) return base;
    return `${base}/v1`;
  }
  return base;
}

function providerApiKey(config: ProviderRuntime): string {
  if (config.apiKey) return config.apiKey;
  if (config.providerId === 'ollama' || config.providerId === 'apple-foundation-models') {
    return LOCAL_PLACEHOLDER_KEY;
  }
  return '';
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
    if (typeof row.requirementId !== 'string' || !requirementIds.has(row.requirementId)) continue;

    const scope =
      row.scope === 'work' && typeof row.entryId === 'string' && row.entryId.trim().length > 0
        ? { kind: 'work' as const, entryId: row.entryId.trim() }
        : row.scope === 'project' && typeof row.entryId === 'string' && row.entryId.trim().length > 0
          ? { kind: 'project' as const, entryId: row.entryId.trim() }
          : { kind: 'resume' as const };

    out.push({
      id: randomId(),
      requirementIds: [row.requirementId],
      text: row.text.trim(),
      scope,
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
    if (!isObject(row)) continue;
    if (typeof row.requirementId !== 'string' || !requirementIds.has(row.requirementId)) continue;

    const value = typeof row.value === 'string' ? row.value.trim() : '';
    const targetRef = typeof row.targetRef === 'string' ? row.targetRef.trim() : '';
    if (!value || !targetRef) continue;

    const quote = typeof row.quote === 'string' ? row.quote.trim() : '';
    if (!quote) continue;

    const snapshotRef =
      typeof row.snapshotRef === 'string' && row.snapshotRef.trim().length > 0
        ? row.snapshotRef.trim()
        : targetRef;

    const evidence: EvidenceRef[] = [{ source: 'resume', snapshotRef, quote }];
    const rationale =
      typeof row.rationale === 'string' && row.rationale.trim().length > 0
        ? row.rationale.trim()
        : 'Tailoring proposal generated from provided resume evidence.';

    const textTarget = textMap.get(targetRef);
    if (textTarget) {
      out.push({
        id: randomId(),
        operation: {
          kind: 'setText',
          target: textTarget.target,
          expected: textTarget.expected,
          value,
        },
        requirementIds: [row.requirementId],
        evidence,
        rationale,
      });
      continue;
    }

    const appendParent = appendMap.get(targetRef);
    if (appendParent) {
      out.push({
        id: randomId(),
        operation: {
          kind: 'appendHighlight',
          parent: appendParent.parent,
          expectedHighlightsHash: appendParent.expectedHighlightsHash,
          value,
        },
        requirementIds: [row.requirementId],
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
  streamText: (input: {
    model: unknown;
    prompt: string;
    maxTokens?: number;
    temperature?: number;
    abortSignal?: AbortSignal;
    onError?: (event: { error: unknown }) => void;
  }) => { consumeStream: () => Promise<void>; text: Promise<string> };
  createOpenAI: (config: { apiKey?: string; baseURL?: string }) => (modelId: string) => unknown;
}> {
  const aiModuleName = 'ai';
  const openAiModuleName = '@ai-sdk/openai';

  const [{ generateText, streamText }, { createOpenAI }] = await Promise.all([
    import(aiModuleName),
    import(openAiModuleName),
  ]);

  return {
    generateText,
    streamText,
    createOpenAI,
  };
}

type TextGenerator = (
  config: ProviderRuntime,
  prompt: string,
  signal: AbortSignal,
  maxTokens: number,
) => Promise<string>;

async function generateWithAiSdk(
  config: ProviderRuntime,
  prompt: string,
  signal: AbortSignal,
  maxTokens: number,
): Promise<string> {
  const { generateText, createOpenAI } = await loadAiSdk();

  const modelFactory = createOpenAI({
    apiKey: providerApiKey(config),
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

/**
 * Streaming variant. `fm serve` (Apple Foundation Models) only ever answers
 * with SSE, so it cannot use the non-streaming JSON path.
 */
async function streamWithAiSdk(
  config: ProviderRuntime,
  prompt: string,
  signal: AbortSignal,
  maxTokens: number,
): Promise<string> {
  const { streamText, createOpenAI } = await loadAiSdk();

  const modelFactory = createOpenAI({
    apiKey: providerApiKey(config),
    baseURL: normalizeBaseUrl(config),
  });

  const state: { error: string | null } = { error: null };

  const result = streamText({
    model: modelFactory(config.model),
    prompt,
    maxTokens,
    temperature: 0,
    abortSignal: signal,
    onError: ({ error }) => {
      state.error = describeError(error);
    },
  });

  await result.consumeStream();
  const text = await result.text;

  // `fm serve` reports errors inside the stream (HTTP 200, `event: error`), so
  // the text promise resolves empty instead of rejecting. Surface the cause.
  if (!text.trim() && state.error) {
    throw new Error(state.error);
  }

  return text;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (isObject(error) && typeof error.message === 'string') return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Conservative English token estimate. One token per three characters
 * overestimates by roughly a third, which keeps us clear of tokenizer drift.
 */
const CHARS_PER_TOKEN = 3;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN) + 8;
}

const NO_LIMIT = Number.POSITIVE_INFINITY;

/** Cloud endpoints offer 128k windows; `fm serve` is the tight one. */
const FALLBACK_CONTEXT_LIMIT = 128_000;
/** Apple Foundation Models: hard prompt + completion window. */
const APPLE_FOUNDATION_MODELS_CONTEXT_LIMIT = 8192;

function contextLimitFor(config: ProviderRuntime): number {
  if (config.providerId === 'apple-foundation-models') {
    return APPLE_FOUNDATION_MODELS_CONTEXT_LIMIT;
  }
  return FALLBACK_CONTEXT_LIMIT;
}

function maxOutputTokensFor(config: ProviderRuntime): number {
  return config.providerId === 'apple-foundation-models' ? 1200 : 2400;
}

/** Tokens the prompt may occupy, keeping room for the answer and estimate drift. */
export function promptTokenBudget(config: ProviderRuntime, maxOutputTokens: number): number {
  const limit = contextLimitFor(config);
  const safety = Math.ceil(limit * 0.1);
  return Math.max(256, limit - maxOutputTokens - safety);
}

interface CompressionPlan {
  jobChars: number;
  entries: number;
  highlightsPerEntry: number;
  textChars: number;
  targetPreviewChars: number;
}

/**
 * Tried in order; the first plan that fits the token budget wins. Later plans
 * drop entries, shorten text and finally omit value previews from textTargets.
 */
const UNCOMPRESSED_PLAN: CompressionPlan = {
  jobChars: NO_LIMIT,
  entries: NO_LIMIT,
  highlightsPerEntry: NO_LIMIT,
  textChars: NO_LIMIT,
  targetPreviewChars: NO_LIMIT,
};

const COMPRESSION_PLANS: CompressionPlan[] = [
  UNCOMPRESSED_PLAN,
  { jobChars: 16_000, entries: 24, highlightsPerEntry: 16, textChars: 800, targetPreviewChars: 200 },
  { jobChars: 10_000, entries: 16, highlightsPerEntry: 10, textChars: 500, targetPreviewChars: 120 },
  { jobChars: 6_000, entries: 10, highlightsPerEntry: 8, textChars: 350, targetPreviewChars: 80 },
  { jobChars: 3_500, entries: 8, highlightsPerEntry: 6, textChars: 250, targetPreviewChars: 0 },
  { jobChars: 2_000, entries: 5, highlightsPerEntry: 4, textChars: 180, targetPreviewChars: 0 },
  { jobChars: 1_200, entries: 3, highlightsPerEntry: 3, textChars: 140, targetPreviewChars: 0 },
];

function truncateText(value: string, limit: number): string {
  if (!Number.isFinite(limit) || value.length <= limit) return value;
  if (limit <= 0) return '';

  const head = Math.ceil(limit * 0.7);
  const tail = limit - head;
  const omitted = value.length - limit;
  const marker = `[…${omitted} chars omitted…]`;
  if (tail <= 0) return `${value.slice(0, head)}\n${marker}`;
  return `${value.slice(0, head)}\n${marker}\n${value.slice(-tail)}`;
}

function take<T>(items: T[], limit: number): T[] {
  return Number.isFinite(limit) ? items.slice(0, limit) : items;
}

function compactProjection(
  snapshot: TailoringSnapshot,
  plan: CompressionPlan,
): TailoringSnapshot {
  const trunc = (value: string | undefined): string | undefined =>
    value === undefined ? undefined : truncateText(value, plan.textChars);

  const compactHighlights = (
    highlights: TailoringSnapshot['projection']['work'][number]['highlights'],
  ) =>
    take(highlights, plan.highlightsPerEntry).map((highlight) => ({
      highlightId: highlight.highlightId,
      value: truncateText(highlight.value, plan.textChars),
    }));

  return {
    projection: {
      summary: trunc(snapshot.projection.summary),
      work: take(snapshot.projection.work, plan.entries).map((entry) => ({
        entryId: entry.entryId,
        summary: trunc(entry.summary),
        highlights: compactHighlights(entry.highlights),
      })),
      projects: take(snapshot.projection.projects, plan.entries).map((entry) => ({
        entryId: entry.entryId,
        description: trunc(entry.description),
        highlights: compactHighlights(entry.highlights),
      })),
    },
    snapshotHash: snapshot.snapshotHash,
  };
}

/**
 * The model only needs the refs to build `targetRef` values; the server keeps
 * the full manifest for validation. Values are shortened or dropped entirely.
 */
function compactTextTargets(
  rows: TextTargetManifestRow[],
  previewChars: number,
): Array<{ ref: string; exists: boolean; value?: string }> {
  return rows.map((row) => {
    const compact: { ref: string; exists: boolean; value?: string } = {
      ref: row.ref,
      exists: row.expected.exists,
    };
    const value = row.expected.value;
    if (value !== null && previewChars !== 0) {
      compact.value = Number.isFinite(previewChars) ? truncateText(value, previewChars) : value;
    }
    return compact;
  });
}

function buildAnalysisPrompt(
  input: AnalyzeInput,
  plan: CompressionPlan = UNCOMPRESSED_PLAN,
): string {
  // Manifests are built from the compacted snapshot, so dropped entries never
  // show up as targetRefs the model could pick.
  const snapshot = compactProjection(input.snapshot, plan);
  const textTargets = textTargetManifest(snapshot);
  const appendParents = appendParentManifest(snapshot);

  // The example carries a real ref, so a model that copies it still lands on a
  // valid target instead of an invented one.
  const exampleAppendRef = appendParents[0]?.ref ?? 'append:work:entry-1';

  return [
    'You are an expert resume tailoring assistant.',
    'Return ONLY valid JSON with keys: requirements, proposals, questions.',
    'Each proposal has one requirementId, one targetRef, a value, a quote and a rationale.',
    'Each question has one requirementId, a text and a scope.',
    'Copy targetRef exactly from textTargets (rewrite existing text) or appendParents (add a highlight).',
    'quote must be text copied from resumeSnapshot. Never invent candidate evidence.',
    'snapshotRef is optional; omit it unless you know the snapshot path.',
    'The example below shows the shape only. Never copy its literal values.',
    'Use double quotes around every key. Keep each string value under 240 characters.',
    'Return at most 6 requirements, 4 proposals and 3 questions.',
    'Text ending with an omitted marker was truncated; never quote the marker.',
    '',
    'jobDescription:',
    truncateText(input.jobText, plan.jobChars),
    '',
    'resumeSnapshot:',
    JSON.stringify(snapshot.projection),
    '',
    'textTargets:',
    JSON.stringify(compactTextTargets(textTargets, plan.targetPreviewChars)),
    '',
    'appendParents:',
    JSON.stringify(appendParents),
    '',
    'Output shape exactly:',
    JSON.stringify({
      requirements: [
        {
          id: 'req-1',
          text: 'short requirement',
          jobQuote: 'short quote from jobDescription',
          importance: 'high',
          status: 'supported',
        },
      ],
      proposals: [
        {
          requirementId: 'req-1',
          targetRef: exampleAppendRef,
          value: 'new highlight text',
          quote: 'text copied from resumeSnapshot',
          rationale: 'why it fits',
        },
      ],
      questions: [
        {
          requirementId: 'req-1',
          text: 'question to ask the candidate',
          scope: 'resume',
        },
      ],
    }),
  ].join('\n');
}

/**
 * Picks the richest compression plan that fits the provider's prompt budget,
 * so a request never exceeds the provider's context window.
 */
export function buildFittingPrompt(
  input: AnalyzeInput,
  budget: number,
): { prompt: string; plan: CompressionPlan } {
  let prompt = '';
  let plan = UNCOMPRESSED_PLAN;

  for (const candidate of COMPRESSION_PLANS) {
    prompt = buildAnalysisPrompt(input, candidate);
    plan = candidate;
    if (estimateTokens(prompt) <= budget) break;
  }

  return { prompt, plan };
}

function isContextOverflowError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /context (size|length|window)|content contains|transcript exceeded|too many tokens|maximum allowed context/i.test(
    message,
  );
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

async function generateDraft(
  config: ProviderRuntime,
  signal: AbortSignal,
  generate: TextGenerator,
  prompt: string,
  maxOutputTokens: number,
): Promise<GeneratedDraft> {
  const raw = await generate(config, prompt, signal, maxOutputTokens);
  if (process.env.AI_DEBUG_RAW === '1') {
    process.stderr.write(`[ai-service] raw model output: ${JSON.stringify(raw)}\n`);
  }

  try {
    return extractJsonObject(raw) as GeneratedDraft;
  } catch (error) {
    // On-device models sometimes break JSON formatting; one clean retry is
    // cheaper than failing the whole analysis.
    const retry = await generate(config, prompt, signal, maxOutputTokens);
    if (process.env.AI_DEBUG_RAW === '1') {
      process.stderr.write(`[ai-service] raw retry output: ${JSON.stringify(retry)}\n`);
    }
    try {
      return extractJsonObject(retry) as GeneratedDraft;
    } catch {
      throw error;
    }
  }
}

async function runAiSdkAnalysis(
  inputRaw: AnalyzeInput,
  config: ProviderRuntime,
  signal: AbortSignal,
  generate: TextGenerator,
): Promise<AnalysisEnvelope> {
  const input = parseAnalyzeInput(inputRaw);
  const textTargets = textTargetManifest(input.snapshot);
  const appendParents = appendParentManifest(input.snapshot);

  const maxOutputTokens = maxOutputTokensFor(config);
  const budget = promptTokenBudget(config, maxOutputTokens);

  let parsed: GeneratedDraft;
  try {
    parsed = await generateDraft(
      config,
      signal,
      generate,
      buildFittingPrompt(input, budget).prompt,
      maxOutputTokens,
    );
  } catch (error) {
    if (!isContextOverflowError(error)) throw error;
    // The provider counts tokens differently than we do; retry once with half
    // the budget and a shorter answer.
    parsed = await generateDraft(
      config,
      signal,
      generate,
      buildFittingPrompt(input, Math.floor(budget / 2)).prompt,
      Math.max(400, Math.floor(maxOutputTokens / 2)),
    );
  }

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

async function runAiSdkPing(
  config: ProviderRuntime,
  signal: AbortSignal,
  generate: TextGenerator,
): Promise<void> {
  const prompt = 'Reply with exactly: OK';
  const text = await generate(config, prompt, signal, 8);
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
      await runAiSdkPing(config, signal, generateWithAiSdk);
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
    return runAiSdkAnalysis(input, config, signal, generateWithAiSdk);
  },
};

const ollamaAdapter: ProviderAdapter = {
  async testConnection(config, signal) {
    try {
      await runAiSdkPing(config, signal, generateWithAiSdk);
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
    return runAiSdkAnalysis(input, config, signal, generateWithAiSdk);
  },
};

/**
 * Apple Foundation Models (`fm serve`). Loopback-only, no credential, and the
 * server answers every request with SSE — never with a JSON body.
 */
const appleFoundationModelsAdapter: ProviderAdapter = {
  async testConnection(config, signal) {
    try {
      await runAiSdkPing(config, signal, streamWithAiSdk);
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
    return runAiSdkAnalysis(input, config, signal, streamWithAiSdk);
  },
};

export function adapterFor(providerId: ProviderRuntime['providerId']): ProviderAdapter {
  if (providerId === 'openai-compatible') return openAiCompatibleAdapter;
  if (providerId === 'ollama') return ollamaAdapter;
  if (providerId === 'apple-foundation-models') return appleFoundationModelsAdapter;
  return mockAdapter;
}
