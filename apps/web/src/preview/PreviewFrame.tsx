import { useEffect, useRef, useState } from 'react';
import type { JsonResume } from '@resume-studio/transformer';
import type { ThemeId } from '@resume-studio/themes';
import { requestRender } from './renderClient.js';

interface PreviewFrameProps {
  resume: JsonResume;
  theme: ThemeId;
}

const DEBOUNCE_MS = 300;

export function PreviewFrame({ resume, theme }: PreviewFrameProps) {
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
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
        });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer.current);
  }, [resume, theme]);

  if (error) {
    return (
      <div className="p-4 text-sm text-red-600">
        <p className="font-semibold">Preview error</p>
        <pre className="mt-2 whitespace-pre-wrap font-mono text-xs">{error}</pre>
      </div>
    );
  }

  return (
    <iframe
      title="Resume preview"
      sandbox="allow-same-origin"
      srcDoc={html}
      className="h-full w-full border-0 bg-white"
    />
  );
}
