import { useEffect, useRef, useState } from 'react';
import type { JsonResume } from '@resume-studio/transformer';
import type { ThemeId } from '@resume-studio/themes';
import { requestRender } from './renderClient.js';
import { Loader2 } from 'lucide-react';

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
    setLoading(true);
    timer.current = window.setTimeout(() => {
      const controller = new AbortController();
      requestRender({ resume, theme }, controller.signal)
        .then((res) => {
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
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-md space-y-2 text-center">
          <p className="text-sm font-medium text-destructive">Preview error</p>
          <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{error}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <iframe
        title="Resume preview"
        sandbox="allow-same-origin"
        srcDoc={html}
        className="h-full w-full border-0 bg-white"
      />
    </div>
  );
}
