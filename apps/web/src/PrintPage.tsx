import { useEffect, useRef, useState } from 'react';
import type { JsonResume } from '@resume-studio/transformer';
import type { ThemeId } from '@resume-studio/themes';
import { requestRender } from './preview/renderClient.js';
import { Button } from './components/ui/button.js';
import { Loader2, Printer, ArrowLeft } from 'lucide-react';

export function PrintPage() {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const run = async (): Promise<void> => {
      const params = new URLSearchParams(window.location.search);
      const key = params.get('k');
      if (!key) {
        setError('Missing print key.');
        return;
      }
      let payload: string;
      try {
        payload = localStorage.getItem(key) ?? '';
      } catch {
        setError('Failed to read print payload from localStorage.');
        return;
      }
      if (!payload) {
        setError('Print payload not found or expired.');
        return;
      }
      let data: { resume: JsonResume; theme: ThemeId };
      try {
        data = JSON.parse(payload);
      } catch {
        setError('Invalid print payload.');
        return;
      }
      try {
        const res = await requestRender({ resume: data.resume, theme: data.theme });
        setHtml(res);
        setError(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        try {
          localStorage.removeItem(key);
        } catch {
          // Payload cleanup is best-effort; ignore storage failures.
        }
      }
    };
    void run();
  }, []);

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
    }
  };

  const handleBack = () => {
    window.close();
    if (!window.closed) {
      window.location.href = '/';
    }
  };

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md space-y-4 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button size="sm" variant="outline" onClick={handleBack}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to editor
          </Button>
        </div>
      </div>
    );
  }

  if (!html) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Rendering resume…</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-screen flex-col bg-background">
        <header className="flex h-12 shrink-0 items-center justify-between border-b bg-card px-6 print:hidden">
          <Button size="sm" variant="ghost" onClick={handleBack}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
          <Button size="sm" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
        </header>
        <main className="flex-1 overflow-hidden">
          <iframe
            ref={iframeRef}
            title="Print preview"
            sandbox="allow-same-origin allow-scripts allow-modals"
            srcDoc={html}
            className="h-full w-full border-0 bg-white"
          />
        </main>
      </div>
    </>
  );
}
