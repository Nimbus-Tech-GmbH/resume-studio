import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Plus } from 'lucide-react';

import { useResumeList, useCreateResume } from '@/graphql/useResume';
import { useEditorStore } from '@/state/editorStore';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface StartupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DialogPhase =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'empty'; showFlash: boolean }
  | { status: 'ready'; resumes: NonNullable<ReturnType<typeof useResumeList>['data']> };

function useStartupDialogState(): DialogPhase {
  const { data: list, isLoading, error } = useResumeList();
  const [showFlash, setShowFlash] = useState(false);
  const wasLoading = useRef(true);

  useEffect(() => {
    if (wasLoading.current && !isLoading && list && list.length === 0) {
      setShowFlash(true);
      const timer = setTimeout(() => setShowFlash(false), 2000);
      return () => clearTimeout(timer);
    }
    wasLoading.current = isLoading;
  }, [isLoading, list]);

  if (isLoading) return { status: 'loading' };
  if (error) return { status: 'error' };
  if (list && list.length === 0) return { status: 'empty', showFlash };
  if (list) return { status: 'ready', resumes: list };
  return { status: 'loading' };
}

const DESCRIPTIONS: Record<DialogPhase['status'], string> = {
  loading: 'Fetching your resumes…',
  error: 'Something went wrong loading your resumes.',
  empty: 'Create your first resume to get started.',
  ready: 'Select an existing resume or create a new one to get started.',
};

export function StartupDialog({ open, onOpenChange }: StartupDialogProps) {
  const phase = useStartupDialogState();
  const setResumeId = useEditorStore((s) => s.setResumeId);
  const setIsStartup = useEditorStore((s) => s.setIsStartup);
  const createResume = useCreateResume();

  const dismiss = useCallback(
    () => onOpenChange(false),
    [onOpenChange],
  );

  const selectResume = useCallback(
    (id: string) => {
      setIsStartup(false);
      setResumeId(id);
      dismiss();
    },
    [setIsStartup, setResumeId, dismiss],
  );

  const createNew = useCallback(async () => {
    const id = await createResume.mutateAsync({});
    setIsStartup(false);
    setResumeId(id);
    dismiss();
  }, [createResume, setIsStartup, setResumeId, dismiss]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar size="lg">
              <AvatarImage src="./logo.png" />
            </Avatar>
            <div>
              <DialogTitle>Welcome to Resume Studio</DialogTitle>
              <DialogDescription>
                {DESCRIPTIONS[phase.status]}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          {phase.status === 'loading' && <LoadingState />}

          {phase.status === 'error' && <ErrorState />}

          {phase.status === 'empty' && phase.showFlash && <EmptyFlash />}

          {phase.status === 'ready' && (
            <ResumeList resumes={phase.resumes} onSelect={selectResume} />
          )}

          <Button
            className="w-full"
            onClick={createNew}
            disabled={createResume.isPending}
          >
            {createResume.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Plus data-icon="inline-start" />
            )}
            Create New Resume
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center gap-2 py-3">
      <Spinner className="size-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Fetching resumes…</span>
    </div>
  );
}

function ErrorState() {
  return null;
}

function EmptyFlash() {
  return (
    <p className="animate-fade-out py-2 text-center text-sm text-muted-foreground">
      No resumes yet.
    </p>
  );
}

interface ResumeListProps {
  resumes: NonNullable<ReturnType<typeof useResumeList>['data']>;
  onSelect: (id: string) => void;
}

function ResumeList({ resumes, onSelect }: ResumeListProps) {
  return (
    <div className="space-y-2">
      {resumes.map((r) => (
        <Button
          key={r.id}
          variant="outline"
          className="h-auto w-full justify-start gap-3 p-3"
          onClick={() => onSelect(r.id)}
        >
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 text-left">
            <div className="truncate font-medium">
              {r.title ?? r.basicInformation?.name ?? 'Untitled'}
            </div>
            {r.language && (
              <div className="truncate text-xs text-muted-foreground">
                {r.language.value ?? r.language.label}
              </div>
            )}
          </div>
        </Button>
      ))}
    </div>
  );
}
