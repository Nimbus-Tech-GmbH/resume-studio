import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import type { JsonResume } from '@resume-studio/transformer';
import type { ThemeId } from '@resume-studio/themes';
import { THEMES } from '@resume-studio/themes';
import { requestRender } from '@/preview/renderClient';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Printer, ArrowLeft } from 'lucide-react';

// Validate print key format: must be print-<hex> to prevent guessing attacks
const PRINT_KEY_PATTERN = /^print-[a-f0-9]{24,}$/;

// Schema to validate print payload structure
const printPayloadSchema = z.object({
  resume: z.object({
    basics: z
      .object({
        name: z.string().optional(),
      })
      .passthrough()
      .optional(),
  }).passthrough(),
  theme: z.enum(THEMES.map((t) => t.id) as [string, ...string[]]),
});

type PrintPayload = z.infer<typeof printPayloadSchema>;

export function PrintPage() {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const run = async (): Promise<void> => {
      const params = new URLSearchParams(window.location.search);
      const key = params.get('k');

      // 1. Validate key format
      if (!key || !PRINT_KEY_PATTERN.test(key)) {
        setError('Invalid print key format.');
        return;
      }

      // 2. Retrieve from sessionStorage (cleared on tab close, safer than localStorage)
      let payload: string;
      try {
        payload = sessionStorage.getItem(key) ?? '';
      } catch {
        setError('Failed to read print payload from storage.');
        return;
      }

      if (!payload) {
        setError('Print payload not found or expired.');
        return;
      }

      // 3. Parse and validate against schema
      let data: PrintPayload;
      try {
        const parsed = JSON.parse(payload);
        data = printPayloadSchema.parse(parsed);
      } catch (err) {
        // Don't expose schema details to user
        setError('Invalid print payload.');
        return;
      }

      // 4. Render the resume
      try {
        const res = await requestRender({
          resume: data.resume as JsonResume,
          theme: data.theme as typeof THEMES[number]['id'],
        });
        setHtml(res);
        setError(null);
      } catch (err: unknown) {
        // Generic error message to user; log details server-side
        setError('Failed to render resume. Please try again.');
      } finally {
        // 5. Clean up payload (best-effort)
        try {
          sessionStorage.removeItem(key);
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
      <div
        className="flex h-screen flex-col gap-4 bg-background p-8"
        role="status"
        aria-label="Rendering resume"
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          <Spinner className="size-4" />
          <span className="text-sm">Rendering resume…</span>
        </div>
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-64 w-full" />
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
            sandbox="allow-same-origin"
            srcDoc={html}
            className="h-full w-full border-0 bg-white"
          />
        </main>
      </div>
    </>
  );
}
