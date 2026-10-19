import type { JsonResume } from '@resume-studio/transformer';
import type { EditorIdentityState } from '@/state/editorStore';

export interface ResumeProjectionWorkEntry {
  entryId: string;
  summary?: string;
  highlights: Array<{ highlightId: string; value: string }>;
}

export interface ResumeProjectionProjectEntry {
  entryId: string;
  description?: string;
  highlights: Array<{ highlightId: string; value: string }>;
}

export interface TailoringSnapshot {
  projection: {
    summary?: string;
    work: ResumeProjectionWorkEntry[];
    projects: ResumeProjectionProjectEntry[];
  };
  snapshotHash: string;
}

function stableHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `h${(hash >>> 0).toString(16)}`;
}

export function createTailoringSnapshot(
  resume: JsonResume,
  editorIds: EditorIdentityState,
): TailoringSnapshot {
  const work = (resume.work ?? []).map((entry, index) => {
    const ids = editorIds.work[index];
    const highlights = (entry.highlights ?? []).map((value, highlightIndex) => ({
      highlightId: ids?.highlightIds[highlightIndex] ?? `missing-work-highlight-${index}-${highlightIndex}`,
      value,
    }));

    return {
      entryId: ids?.entryId ?? `missing-work-entry-${index}`,
      summary: entry.summary,
      highlights,
    };
  });

  const projects = (resume.projects ?? []).map((entry, index) => {
    const ids = editorIds.projects[index];
    const highlights = (entry.highlights ?? []).map((value, highlightIndex) => ({
      highlightId: ids?.highlightIds[highlightIndex] ?? `missing-project-highlight-${index}-${highlightIndex}`,
      value,
    }));

    return {
      entryId: ids?.entryId ?? `missing-project-entry-${index}`,
      description: entry.description,
      highlights,
    };
  });

  const projection = {
    summary: resume.basics?.summary,
    work,
    projects,
  };

  return {
    projection,
    snapshotHash: stableHash(JSON.stringify(projection)),
  };
}

export function hasMeaningfulResumeContent(resume: JsonResume): boolean {
  if (resume.basics?.summary && resume.basics.summary.trim().length > 0) return true;

  const hasWorkContent = (resume.work ?? []).some(
    (entry) =>
      (entry.summary && entry.summary.trim().length > 0) ||
      (entry.highlights ?? []).some((highlight) => highlight.trim().length > 0),
  );

  if (hasWorkContent) return true;

  return (resume.projects ?? []).some(
    (entry) =>
      (entry.description && entry.description.trim().length > 0) ||
      (entry.highlights ?? []).some((highlight) => highlight.trim().length > 0),
  );
}
