import { useEffect, useState } from 'react';
import { FileText, Plus } from 'lucide-react';

import { useResumeList, useCreateResume } from '@/graphql/useResume';
import { useEditorStore } from '@/state/editorStore';
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

export function StartupDialog({ open, onOpenChange }: StartupDialogProps) {
  const { data: list, isLoading, error } = useResumeList();
  const setResumeId = useEditorStore((s) => s.setResumeId);
  const setIsStartup = useEditorStore((s) => s.setIsStartup);
  const createResume = useCreateResume();

  const [showEmpty, setShowEmpty] = useState(false);

  // When list finishes loading and is empty, briefly show "No resumes yet"
  useEffect(() => {
    if (!isLoading && list && list.length === 0) {
      setShowEmpty(true);
      const timer = setTimeout(() => setShowEmpty(false), 2000);
      return () => clearTimeout(timer);
    }
    setShowEmpty(false);
  }, [isLoading, list]);

  const handleSelectResume = (id: string) => {
    setIsStartup(false);
    setResumeId(id);
    onOpenChange(false);
  };

  const handleCreateResume = async () => {
    const id = await createResume.mutateAsync({});
    setIsStartup(false);
    setResumeId(id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Welcome to Resume Studio</DialogTitle>
          <DialogDescription>
            Select an existing resume or create a new one to get started.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-3">
              <Spinner className="size-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Fetching resumes…</span>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">
              Failed to load resumes. Please try again.
            </p>
          )}

          {!isLoading && list && list.length > 0 && (
            <div className="space-y-2">
              {list.map((r) => (
                <Button
                  key={r.id}
                  variant="outline"
                  className="h-auto w-full justify-start gap-3 p-3"
                  onClick={() => handleSelectResume(r.id)}
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
          )}

          {showEmpty && (
            <p className="animate-fade-out py-2 text-center text-sm text-muted-foreground">
              No resumes yet.
            </p>
          )}

          <Button
            className="w-full"
            onClick={handleCreateResume}
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
