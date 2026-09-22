import { useEffect } from 'react';
import { ClientError } from 'graphql-request';
import { CaretDownIcon, Plus } from '@phosphor-icons/react';
import { fromCms } from '@resume-studio/transformer';
import { useResume, useResumeList } from '@/graphql/useResume';
import { useAuth } from '@/auth/AuthContext';
import { useEditorStore, EMPTY_RESUME } from '@/state/editorStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';

export function ResumePicker() {
  const { isAuthenticated } = useAuth();
  const { data: list, isLoading, error } = useResumeList();
  const resumeId = useEditorStore((s) => s.resumeId);
  const setResumeId = useEditorStore((s) => s.setResumeId);
  const loadFromCms = useEditorStore((s) => s.loadFromCms);
  const loadFromJson = useEditorStore((s) => s.loadFromJson);
  const isStartup = useEditorStore((s) => s.isStartup);
  const {
    data: resume,
    isLoading: resumeLoading,
    isFetching: resumeFetching,
  } = useResume(resumeId);

  // Whether the store already holds resume data (e.g. from a JSON import).
  const hasLocalData = useEditorStore((s) => Object.keys(s.resume).length > 0);

  useEffect(() => {
    if (isAuthenticated && resume) {
      loadFromCms({ json: fromCms(resume), cms: resume });
    }
  }, [isAuthenticated, resume, loadFromCms]);

  useEffect(() => {
    if (isAuthenticated && !isStartup && !resumeId && !hasLocalData && list && list.length > 0) {
      setResumeId(list[0]!.id);
    }
  }, [isAuthenticated, isStartup, list, resumeId, setResumeId, hasLocalData]);

  const handleCreateResume = () => {
    loadFromJson(EMPTY_RESUME);
  };

  if (!isAuthenticated) {
    return (
      <Button
        variant="outline"
        size="icon-sm"
        onClick={handleCreateResume}
        title="Create new resume"
      >
        <Plus className="size-4" />
      </Button>
    );
  }

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
      >
        <Plus data-icon="inline-start" />
        New Resume
      </Button>
    );
  }

  const currentResume = list?.find((r) => r.id === resumeId)
  const currentLabel = currentResume
    ? `${currentResume.title ?? currentResume.basicInformation?.name ?? resumeId} (${currentResume.language?.value ?? currentResume.language?.label ?? "—"})`
    : "Select resume"

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="min-w-56 justify-start"
              disabled={resumeLoading}
            >
              <span className="truncate">{currentLabel}</span>
              <CaretDownIcon className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Resumes</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={resumeId ?? ""}
              onValueChange={(v) => setResumeId(v || null)}
            >
              {list.map((r) => (
                <DropdownMenuRadioItem key={r.id} value={r.id}>
                  <span className="truncate">
                    {r.title ?? r.basicInformation?.name ?? r.id} ({r.language?.value ?? r.language?.label ?? "—"})
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
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
        title="Create new resume"
      >
        <Plus className="size-4" />
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
