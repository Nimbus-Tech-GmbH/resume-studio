import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import {
  FileTextIcon,
  PlusIcon,
  SignInIcon,
  UploadSimpleIcon,
} from '@phosphor-icons/react';

import { useAuth } from '@/auth/AuthContext';
import { useResumeList, type ResumeListItem } from '@/graphql/useResume';
import { useEditorStore, EMPTY_RESUME } from '@/state/editorStore';
import { validateResume } from '@/validation/schema';
import type { JsonResume } from '@resume-studio/transformer';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ButtonGroup } from '@/components/ui/button-group';

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
  guest: 'Sign in to manage your resumes, or create one locally. Guest work won\u2019t be saved.',
  loading: 'Fetching your resumes\u2026',
  error: 'Something went wrong loading your resumes.',
  empty: 'Create your first resume to get started.',
  ready: 'Select an existing resume or create/upload a new one to get started.',
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

async function parseResumeFile(file: File): Promise<JsonResume> {
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
  const { login } = useAuth();
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
        <DialogHeader className="items-center gap-1 text-center">
          <Avatar size="lg">
            <AvatarImage src="./logo.png" alt="Resume Studio" />
            <AvatarFallback>
              <FileTextIcon />
            </AvatarFallback>
          </Avatar>

          <DialogTitle>Welcome to Resume Studio</DialogTitle>
          <DialogDescription>
            {DESCRIPTIONS[phase.status]}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {phase.status === 'guest' && (
            <div className="mx-auto">
              <Button size="lg" onClick={login} className="cursor-pointer">
                <SignInIcon data-icon="inline-start" />
                Sign in
              </Button>
            </div>
          )}

          <DialogPhaseContent
            phase={phase}
            onSelectResume={selectResume}
          />

          {importErrors.length > 0 && (
            <ImportErrors errors={importErrors} />
          )}
        </div>

        {phase.status === 'guest' && (
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs/relaxed text-muted-foreground">
              or start locally
            </span>
            <Separator className="flex-1" />
          </div>
        )}
        <ButtonGroup orientation="vertical" className="w-full">
          <Button
            variant="outline"
            className="w-full cursor-pointer"
            onClick={createNew}
          >
            <PlusIcon data-icon="inline-start" />
            Create New Resume
          </Button>

          <Button
            variant="outline"
            className="w-full cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadSimpleIcon data-icon="inline-start" />
            Import JSON Resume
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileChange}
          />
        </ButtonGroup>
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
        Fetching your resumes…
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
      We couldn’t load your resumes. You can still create or import one.
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
    <div className="flex flex-col gap-1.5">
      {resumes.map((resume) => (
        <Button
          key={resume.id}
          variant="outline"
          className="h-auto gap-3 justify-start p-3"
          onClick={() => onSelect(resume.id)}
        >
          <FileTextIcon
            data-icon="inline-start"
            className="size-4 shrink-0 text-muted-foreground"
          />

          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate font-medium">
              {resume.title ??
                resume.basicInformation?.name ??
                'Untitled'}
            </span>

            {resume.language && (
              <span className="block truncate text-xs text-muted-foreground">
                {resume.language.value ?? resume.language.label}
              </span>
            )}
          </span>
        </Button>
      ))}
    </div>
  );
}
