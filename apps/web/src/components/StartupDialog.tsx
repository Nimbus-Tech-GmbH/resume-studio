import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Plus, Upload } from 'lucide-react';

import { useResumeList, useCreateResume } from '@/graphql/useResume';
import { useEditorStore } from '@/state/editorStore';
import { validateResume } from '@/validation/schema';
import type { JsonResume } from '@resume-studio/transformer';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);

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

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const json = JSON.parse(text) as JsonResume;
        const errors = validateResume(json);

        // Filter to only blocking errors (not warnings)
        const blockingErrors = errors.filter((e) => e.severity === 'error');

        if (blockingErrors.length > 0) {
          setImportErrors(blockingErrors.map((e) => `${e.path}: ${e.message}`));
          return;
        }

        // Valid — populate store
        setImportErrors([]);
        useEditorStore.getState().setResume(json);
        setIsStartup(false);
        dismiss();
      } catch {
        setImportErrors(['Invalid JSON file.']);
      } finally {
        // Reset file input so the same file can be re-selected
        event.target.value = '';
      }
    },
    [dismiss, setIsStartup],
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

          {importErrors.length > 0 && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <p className="font-medium">Import validation failed:</p>
              <ul className="mt-1 list-inside list-disc">
                {importErrors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {importErrors.length > 5 && (
                  <li>…and {importErrors.length - 5} more</li>
                )}
              </ul>
            </div>
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

          <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
            <Upload className="size-4" />
            Import JSON Resume
          </Button>

          <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center gap-2 py-3">
      <Spinner className="size-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{DESCRIPTIONS["loading"]}</span>
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
