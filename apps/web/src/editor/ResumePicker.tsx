import { useEffect } from 'react';
import { ClientError } from 'graphql-request';
import { fromCms } from '@resume-studio/transformer';
import { useResume, useResumeList } from '../graphql/useResume.js';
import { useEditorStore } from '../state/editorStore.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select.js';
import { Skeleton } from '../components/ui/skeleton.js';
import { Spinner } from '../components/ui/spinner.js';

export function ResumePicker() {
  const { data: list, isLoading, error } = useResumeList();
  const resumeId = useEditorStore((s) => s.resumeId);
  const setResumeId = useEditorStore((s) => s.setResumeId);
  const loadFromCms = useEditorStore((s) => s.loadFromCms);
  const {
    data: resume,
    isLoading: resumeLoading,
    isFetching: resumeFetching,
  } = useResume(resumeId);

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

  if (isLoading) {
    return <Skeleton className="h-8 w-56" aria-label="Loading resumes" />;
  }
  if (error) {
    const msg = extractGqlError(error);
    return (
      <span className="text-sm text-destructive" title={msg}>
        Keystone error: {msg.slice(0, 80)}
      </span>
    );
  }
  if (!list || list.length === 0) {
    return <span className="text-sm text-muted-foreground">No resumes</span>;
  }

  return (
    <div className="relative">
      <Select value={resumeId ?? ''} onValueChange={(v) => setResumeId(v || null)} disabled={resumeLoading}>
        <SelectTrigger className="h-8 min-w-56 text-sm" data-loading={resumeFetching || undefined}>
          <SelectValue placeholder="Select resume" />
        </SelectTrigger>
        <SelectContent>
          {list.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.title ?? r.basicInformation?.name ?? r.id} ({r.language?.value ?? r.language?.label ?? '—'})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {resumeFetching && (
        <span
          className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2"
          role="status"
          aria-label="Loading resume"
        >
          <Spinner className="size-3.5 text-muted-foreground" />
        </span>
      )}
    </div>
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
