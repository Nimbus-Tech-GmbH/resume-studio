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
    const key = `print-${Date.now()}`;
    const payload = JSON.stringify({ resume, theme });
    try {
      localStorage.setItem(key, payload);
    } catch {
      console.error('Failed to write print payload to localStorage');
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
