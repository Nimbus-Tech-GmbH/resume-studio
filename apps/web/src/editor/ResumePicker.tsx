import { useEffect } from 'react';
import { ClientError } from 'graphql-request';
import { Plus } from 'lucide-react';
import { fromCms } from '@resume-studio/transformer';
import { useResume, useResumeList, useCreateResume } from '@/graphql/useResume';
import { useEditorStore } from '@/state/editorStore';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';

export function ResumePicker() {
  const { data: list, isLoading, error } = useResumeList();
  const resumeId = useEditorStore((s) => s.resumeId);
  const setResumeId = useEditorStore((s) => s.setResumeId);
  const loadFromCms = useEditorStore((s) => s.loadFromCms);
  const isStartup = useEditorStore((s) => s.isStartup);
  const createResume = useCreateResume();
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
    if (!isStartup && !resumeId && list && list.length > 0) {
      setResumeId(list[0]!.id);
    }
  }, [isStartup, list, resumeId, setResumeId]);

  const handleCreateResume = async () => {
    const id = await createResume.mutateAsync({});
    setResumeId(id);
  };

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
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleCreateResume}
        disabled={createResume.isPending}
      >
        {createResume.isPending ? <Spinner data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
        New Resume
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Select value={resumeId ?? ''} onValueChange={(v) => setResumeId(v || null)} disabled={resumeLoading}>
          <SelectTrigger className="h-8 min-w-56" data-loading={resumeFetching || undefined}>
            <SelectValue placeholder="Select resume" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Resumes</SelectLabel>
              {list.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.title ?? r.basicInformation?.name ?? r.id} ({r.language?.value ?? r.language?.label ?? '—'})
                </SelectItem>
              ))}
            </SelectGroup>
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
      <Button
        variant="outline"
        size="icon-sm"
        onClick={handleCreateResume}
        disabled={createResume.isPending}
        title="Create new resume"
      >
        {createResume.isPending ? <Spinner className="size-4" /> : <Plus className="size-4" />}
      </Button>
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
