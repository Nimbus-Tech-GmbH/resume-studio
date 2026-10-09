import { useEditorStore } from '@/state/editorStore';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileJson, FileText } from 'lucide-react';

export function ExportMenu() {
  const resume = useEditorStore((s) => s.resume);
  const theme = useEditorStore((s) => s.theme);

  const exportJson = () => {
    const name = resume.basics?.name || 'resume';
    const fileName = name.toLowerCase().replace(/\s+/g, '-') + '.json';
    const json = JSON.stringify(resume, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    // Use sessionStorage for print payload (cleared on tab close).
    // Generate cryptographically secure random key instead of predictable timestamp.
    const randomBytes = crypto.getRandomValues(new Uint8Array(12));
    const hexKey = Array.from(randomBytes, (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');
    const key = `print-${hexKey}`;
    const payload = JSON.stringify({ resume, theme });
    try {
      sessionStorage.setItem(key, payload);
    } catch {
      // eslint-disable-next-line no-console -- intentional error before early return
      console.error('Failed to write print payload to sessionStorage');
      return;
    }
    const url = new URL('/print', window.location.origin);
    url.searchParams.set('k', key);
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" title="Export resume">
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportJson}>
          <FileJson className="h-4 w-4" />
          Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportPdf}>
          <FileText className="h-4 w-4" />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
