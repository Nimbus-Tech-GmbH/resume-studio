import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { FileText, Plus, Upload } from 'lucide-react';

import { useAuth } from '@/auth/AuthContext';
import { useResumeList, type ResumeListItem } from '@/graphql/useResume';
import { useEditorStore, EMPTY_RESUME } from '@/state/editorStore';
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

type ImportError = {
  path: string;
  message: string;
};

type DialogPhase =
  | { status: 'guest' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'empty'; showFlash: boolean }
  | { status: 'ready'; resumes: ResumeListItem[] };

const DESCRIPTIONS: Record<DialogPhase['status'], string> = {
  guest: 'Create a resume to get started. Your work won\u2019t be saved.',
  loading: 'Fetching your resumes\u2026',
  error: 'Something went wrong loading your resumes.',
  empty: 'Create your first resume to get started.',
  ready: 'Select an existing resume or create a new one to get started.',
};

const FLASH_DURATION_MS = 2_000;

function useEmptyResumeFlash(
  isLoading: boolean,
  resumes: ResumeListItem[] | undefined,
): boolean {
  const [showFlash, setShowFlash] = useState(false);
  const wasLoading = useRef(isLoading);

  useEffect(() => {
    const finishedLoading = wasLoading.current && !isLoading;
    const hasNoResumes = resumes?.length === 0;

    wasLoading.current = isLoading;

    if (!finishedLoading || !hasNoResumes) {
      return;
    }

    setShowFlash(true);

    const timeoutId = window.setTimeout(() => {
      setShowFlash(false);
    }, FLASH_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isLoading, resumes]);

  return showFlash;
}

function useStartupDialogPhase(): DialogPhase {
  const { isAuthenticated } = useAuth();
  const { data: resumes, isLoading, error } = useResumeList();
  const showFlash = useEmptyResumeFlash(isLoading, resumes);

  if (!isAuthenticated) {
    return { status: 'guest' };
  }

  if (isLoading || resumes === undefined) {
    return { status: 'loading' };
  }

  if (error) {
    return { status: 'error' };
  }

  if (resumes.length === 0) {
    return { status: 'empty', showFlash };
  }

  return { status: 'ready', resumes };
}

function parseResumeFile(file: File): Promise<JsonResume> {
  return file.text().then((text) => {
    const json: unknown = JSON.parse(text);
    return json as JsonResume;
  });
}

function getBlockingImportErrors(json: JsonResume): ImportError[] {
  return validateResume(json)
    .filter((error) => error.severity === 'error')
    .map((error) => ({
      path: error.path,
      message: error.message,
    }));
}

export function StartupDialog({
  open,
  onOpenChange,
}: StartupDialogProps) {
  const phase = useStartupDialogPhase();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setResumeId = useEditorStore((state) => state.setResumeId);
  const setIsStartup = useEditorStore((state) => state.setIsStartup);
  const loadFromJson = useEditorStore((state) => state.loadFromJson);

  const [importErrors, setImportErrors] = useState<ImportError[]>([]);

  const dismiss = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const selectResume = useCallback(
    (resumeId: string) => {
      setResumeId(resumeId);
      setIsStartup(false);
      dismiss();
    },
    [dismiss, setIsStartup, setResumeId],
  );

  const createNew = useCallback(() => {
    loadFromJson(EMPTY_RESUME);
    setIsStartup(false);
    dismiss();
  }, [dismiss, loadFromJson, setIsStartup]);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const file = input.files?.[0];

      if (!file) {
        return;
      }

      try {
        const json = await parseResumeFile(file);
        const errors = getBlockingImportErrors(json);

        if (errors.length > 0) {
          setImportErrors(errors);
          return;
        }

        setImportErrors([]);
        loadFromJson(json);
        setIsStartup(false);
        dismiss();
      } catch {
        setImportErrors([
          {
            path: 'file',
            message: 'Invalid JSON file.',
          },
        ]);
      } finally {
        input.value = '';
      }
    },
    [dismiss, loadFromJson, setIsStartup],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar size="lg">
              <AvatarImage src="./logo.png" alt="Resume Studio" />
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
          <DialogPhaseContent
            phase={phase}
            onSelectResume={selectResume}
          />

          {importErrors.length > 0 && (
            <ImportErrors errors={importErrors} />
          )}

          <Button className="w-full" onClick={createNew}>
            <Plus data-icon="inline-start" />
            Create New Resume
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload data-icon="inline-start" />
            Import JSON Resume
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface DialogPhaseContentProps {
  phase: DialogPhase;
  onSelectResume: (resumeId: string) => void;
}

function DialogPhaseContent({
  phase,
  onSelectResume,
}: DialogPhaseContentProps) {
  switch (phase.status) {
    case 'guest':
      return <EmptyFlash />;

    case 'loading':
      return <LoadingState />;

    case 'error':
      return <ErrorState />;

    case 'empty':
      return phase.showFlash ? <EmptyFlash /> : null;

    case 'ready':
      return (
        <ResumeList
          resumes={phase.resumes}
          onSelect={onSelectResume}
        />
      );
  }
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center gap-2 py-3">
      <Spinner className="size-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">
        Fetching your resumes\u2026
      </span>
    </div>
  );
}

function ErrorState() {
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
    >
      We couldn\u2019t load your resumes. You can still create or import one.
    </div>
  );
}

function EmptyFlash() {
  return (
    <p className="animate-fade-out py-2 text-center text-sm text-muted-foreground">
      No resumes yet.
    </p>
  );
}

interface ImportErrorsProps {
  errors: ImportError[];
}

function ImportErrors({ errors }: ImportErrorsProps) {
  const visibleErrors = errors.slice(0, 5);

  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
    >
      <p className="font-medium">Import validation failed:</p>

      <ul className="mt-1 list-inside list-disc">
        {visibleErrors.map((error, index) => (
          <li key={`${error.path}-${error.message}-${index}`}>
            {error.path}: {error.message}
          </li>
        ))}

        {errors.length > visibleErrors.length && (
          <li>\u2026and {errors.length - visibleErrors.length} more</li>
        )}
      </ul>
    </div>
  );
}

interface ResumeListProps {
  resumes: ResumeListItem[];
  onSelect: (resumeId: string) => void;
}

function ResumeList({ resumes, onSelect }: ResumeListProps) {
  return (
    <div className="space-y-2">
      {resumes.map((resume) => (
        <Button
          key={resume.id}
          variant="outline"
          className="h-auto w-full justify-start gap-3 p-3"
          onClick={() => onSelect(resume.id)}
        >
          <FileText className="size-4 shrink-0 text-muted-foreground" />

          <div className="min-w-0 flex-1 text-left">
            <div className="truncate font-medium">
              {resume.title ??
                resume.basicInformation?.name ??
                'Untitled'}
            </div>

            {resume.language && (
              <div className="truncate text-xs text-muted-foreground">
                {resume.language.value ?? resume.language.label}
              </div>
            )}
          </div>
        </Button>
      ))}
    </div>
  );
}
