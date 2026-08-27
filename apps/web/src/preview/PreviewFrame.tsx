import { useEffect, useRef, useState } from 'react';
import type { JsonResume } from '@resume-studio/transformer';
import type { ThemeId } from '@resume-studio/themes';
import { requestRender } from './renderClient';
import { Skeleton } from '@/components/ui/skeleton';

interface PreviewFrameProps {
  resume: JsonResume;
  theme: ThemeId;
}

const DEBOUNCE_MS = 300;

export function PreviewFrame({ resume, theme }: PreviewFrameProps) {
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setLoading(true);
      const controller = new AbortController();
      requestRender({ resume, theme }, controller.signal)
        .then((res: string) => {
          setHtml(res);
          setError(null);
        })
        .catch((err: unknown) => {
          if ((err as { name?: string })?.name === 'AbortError') return;
          setError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer.current);
  }, [resume, theme]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md space-y-2 text-center">
          <p className="text-sm font-medium text-destructive">Preview error</p>
          <pre className="whitespace-pre-wrap text-sm text-muted-foreground">{error}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      {/* First load: skeleton placeholder. Subsequent loads: dim overlay keeps
          the previous render visible so edits don't flash. */}
      {loading && !html && (
        <div
          className="absolute inset-0 z-10 flex flex-col gap-4 bg-background p-8"
          role="status"
          aria-label="Rendering preview"
        >
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      )}
      {loading && html && (
        <div
          className="pointer-events-none absolute inset-0 z-10 bg-background/50 transition-opacity"
          role="status"
          aria-label="Updating preview"
        />
      )}
      <iframe
        title="Resume preview"
        sandbox="allow-same-origin allow-scripts"
        srcDoc={html}
        className="h-full w-full border-0 bg-white"
      />
    </div>
  );
}
