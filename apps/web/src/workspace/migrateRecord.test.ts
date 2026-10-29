import { describe, expect, it } from 'vitest';
import { hashResume, type AnalysisEnvelope } from '@resume-studio/ai';
import type { AnyPersistedWorkspaceRecord } from './schema';
import { migrateWorkspaceRecord } from './migrateRecord';

const resume = {
  basics: { label: 'Engineer', summary: 'Builds things.' },
  work: [{ name: 'Acme', summary: 'Built a platform.', highlights: ['Shipped.'] }],
  projects: [],
  skills: [],
};

function analysis(snapshotHash: string, baseRevision: number): AnalysisEnvelope {
  return {
    schemaVersion: 2,
    analysisId: 'a1',
    workspaceId: 'ws1',
    documentEpoch: 'epoch1',
    baseRevision,
    snapshotHash,
    jobVersion: 1,
    withheldPaths: [],
    response: {
      resume,
      changes: [
        {
          id: 'c1',
          group: 'g1',
          type: 'rewrite-summary',
          section: 'basics',
          entity: 'Summary',
          summary: 'Match the role.',
          path: '/basics/summary',
          op: 'rewrite',
          before: 'Builds things.',
          after: 'Builds resilient things.',
          evidence: [],
        },
      ],
      gaps: [],
    },
  };
}

function record(overrides: Record<string, unknown> = {}): AnyPersistedWorkspaceRecord {
  return {
    version: 2,
    scope: 'guest',
    updatedAt: 1,
    editor: { resume, revision: 3 } as never,
    tailoring: {
      workspaceId: 'ws1',
      jobText: 'Role',
      jobVersion: 1,
      connectionVersion: 1,
      conversationVersion: 0,
      status: 'ready',
      errorMessage: null,
      errorCode: null,
      lastAnalysis: analysis(hashResume(resume), 3),
      changeDecisions: { g1: 'selected' },
      connection: {
        id: 'conn_ollama',
        providerId: 'ollama',
        destination: 'local',
        endpoint: 'http://127.0.0.1:11434/v1',
        model: 'gemma4:latest',
        contextTokens: 32_768,
        maxOutputTokens: 4096,
      },
      lastApplied: null,
      messages: [],
      ...overrides,
    },
  } as unknown as AnyPersistedWorkspaceRecord;
}

describe('migrateWorkspaceRecord', () => {
  it('keeps a current analysis and its decisions', () => {
    const migrated = migrateWorkspaceRecord(record());

    expect(migrated.tailoring.status).toBe('ready');
    expect(migrated.tailoring.lastAnalysis?.analysisId).toBe('a1');
    expect(migrated.tailoring.changeDecisions).toEqual({ g1: 'selected' });
  });

  it('marks an analysis outdated when the editor moved on', () => {
    const migrated = migrateWorkspaceRecord(record({ lastAnalysis: analysis(hashResume(resume), 2) }));

    expect(migrated.tailoring.status).toBe('outdated');
  });

  it('drops a legacy proposal-based analysis', () => {
    const legacyAnalysis = {
      id: 'old',
      proposals: [{ id: 'p1' }],
      assertions: [],
      answerVersion: 2,
    };
    const migrated = migrateWorkspaceRecord(
      record({
        lastAnalysis: legacyAnalysis,
        proposalDecisions: { p1: 'accepted' },
        proposalEdits: {},
        assertions: [],
        answerVersion: 2,
        status: 'streaming',
      }),
    );

    expect(migrated.tailoring.lastAnalysis).toBeNull();
    expect(migrated.tailoring.changeDecisions).toEqual({});
    expect(migrated.tailoring.status).toBe('interrupted');
  });

  it('migrates a legacy cloud connection profile to OpenCode', () => {
    const migrated = migrateWorkspaceRecord(
      record({
        connection: {
          id: 'conn_openai',
          providerId: 'openai',
          destination: 'cloud',
          endpoint: 'https://api.openai.com/v1',
          model: 'gpt-4o-mini',
          contextTokens: 128_000,
          maxOutputTokens: 2400,
          outputMode: 'structured',
        },
      }),
    );

    expect(migrated.tailoring.connection.providerId).toBe('opencode');
    expect(migrated.tailoring.connection.destination).toBe('remote');
    expect(migrated.tailoring.connection.endpoint).toBe(
      'https://opencode.ai/inference/openai/v1',
    );
    expect(migrated.tailoring.connection.model).toBe('deepseek-v4.1-flash');
  });

  it('drops a legacy delta-only applied transaction', () => {
    const migrated = migrateWorkspaceRecord(
      record({
        lastApplied: {
          id: 'tx1',
          analysisId: 'a1',
          documentEpoch: 'epoch1',
          baseRevision: 3,
          changeSet: [{ kind: 'setText', target: '/basics/summary' }],
        },
      }),
    );

    expect(migrated.tailoring.lastApplied).toBeNull();
  });
});
