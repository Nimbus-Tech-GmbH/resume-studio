import { useEffect } from 'react';
import { ClientError } from 'graphql-request';
import { fromCms } from '@resume-studio/transformer';
import { useResume, useResumeList } from '../graphql/useResume.js';
import { useEditorStore } from '../state/editorStore.js';

export function ResumePicker() {
  const { data: list, isLoading, error } = useResumeList();
  const resumeId = useEditorStore((s) => s.resumeId);
  const setResumeId = useEditorStore((s) => s.setResumeId);
  const loadFromCms = useEditorStore((s) => s.loadFromCms);
  const { data: resume } = useResume(resumeId);

  useEffect(() => {
    if (resume) {
      loadFromCms({ json: fromCms(resume), cms: resume });
    }
  }, [resume, loadFromCms]);

  useEffect(() => {
    if (!resumeId && list && list.length > 0) {
      setResumeId(list[0]!.id);
    }
  }, [list, resumeId, setResumeId]);

  if (isLoading) return <span className="text-xs text-neutral-500">Loading…</span>;
  if (error) {
    const msg = extractGqlError(error);
    return (
      <span className="text-xs text-red-600" title={msg}>
        Keystone error: {msg.slice(0, 80)}
      </span>
    );
  }
  if (!list || list.length === 0) {
    return <span className="text-xs text-neutral-500">No resumes</span>;
  }

  return (
    <select
      value={resumeId ?? ''}
      onChange={(e) => setResumeId(e.target.value || null)}
      className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm"
    >
      {list.map((r) => (
        <option key={r.id} value={r.id}>
          {r.title ?? r.basicInformation?.name ?? r.id} ({r.language?.value ?? r.language?.label ?? '—'})
        </option>
      ))}
    </select>
  );
}

function extractGqlError(err: unknown): string {
  if (err instanceof ClientError) {
    const first = err.response?.errors?.[0]?.message;
    if (first) return first;
    return `HTTP ${err.response?.status ?? '?'}`;
  }
  return err instanceof Error ? err.message : String(err);
}
