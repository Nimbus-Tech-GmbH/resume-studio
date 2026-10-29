import {
  createResumePayload,
  type ResumePayload,
} from '@resume-studio/ai';
import type { JsonResume } from '@resume-studio/transformer';

export type TailoringSnapshot = ResumePayload;

export function createTailoringSnapshot(resume: JsonResume): TailoringSnapshot {
  return createResumePayload(resume);
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
