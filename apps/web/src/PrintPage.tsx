/* eslint-disable react-refresh/only-export-components -- print entry consumes handoff before React render */
import { useMemo } from 'react';
import type { PresentationInputV1 } from '@resume-studio/studio-contracts';
import {
  createHttpPresentationTransport,
  PrintPresentation,
} from '@resume-studio/resume-presentation';
import { ArrowLeft, Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { consumePrintHandoff, type PrintHandoffResult } from '@/workspace/printHandoff';

const presentationTransport = createHttpPresentationTransport({
  endpoint: import.meta.env.VITE_RENDER_ENDPOINT ?? 'http://localhost:8787',
});

export function readPrintPageHandoff(): PrintHandoffResult {
  try {
    return consumePrintHandoff(window.location.search, window.localStorage);
  } catch {
    return { ok: false, error: 'Failed to read print payload from storage.' };
  }
}

export function PrintPage({ handoff }: { handoff: PrintHandoffResult }) {
  const input = useMemo<PresentationInputV1 | null>(() => {
    if (!handoff.ok) return null;
    return {
      contractVersion: 1,
      document: {
        key: handoff.key,
        revision: 0,
        resume: handoff.payload.resume,
      },
      themeId: handoff.payload.theme,
    };
  }, [handoff]);

  const handleBack = () => {
    window.close();
    if (!window.closed) {
      window.location.href = '/';
    }
  };

  if (!handoff.ok || input === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md space-y-4 text-center" role="alert">
          <p className="text-sm text-destructive">
            {handoff.ok ? 'Invalid print payload.' : handoff.error}
          </p>
          <Button size="sm" variant="outline" onClick={handleBack}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to editor
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PrintPresentation
      input={input}
      transport={presentationTransport}
      className="print-presentation"
      renderToolbar={({ canPrint, print }) => (
        <header className="flex h-12 shrink-0 items-center justify-between border-b bg-card px-6 print:hidden">
          <Button size="sm" variant="ghost" onClick={handleBack}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
          <Button size="sm" onClick={print} disabled={!canPrint}>
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
        </header>
      )}
    />
  );
}
