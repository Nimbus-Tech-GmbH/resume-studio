import { useEditorStore } from '../state/editorStore.js';
import { Button } from '../components/ui/button.js';
import { Eye } from 'lucide-react';

export function PrintButton() {
  const resume = useEditorStore((s) => s.resume);
  const theme = useEditorStore((s) => s.theme);

  const onClick = () => {
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
    <Button variant="secondary" onClick={onClick} title="Open print preview">
      <Eye className="h-3.5 w-3.5" />
      Preview
    </Button>
  );
}
