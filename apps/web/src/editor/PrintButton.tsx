import { useState } from 'react';
import { useEditorStore } from '../state/editorStore.js';
import { requestRender } from '../preview/renderClient.js';
import { Button } from '../components/ui/button.js';
import { Loader2, Printer } from 'lucide-react';

export function PrintButton() {
  const [loading, setLoading] = useState(false);
  const resume = useEditorStore((s) => s.resume);
  const theme = useEditorStore((s) => s.theme);

  const handlePrint = async () => {
    setLoading(true);
    try {
      const html = await requestRender({ resume, theme });
      
      // Create hidden iframe for printing
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.left = '-9999px';
      iframe.style.top = '0';
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      iframe.style.opacity = '0';
      iframe.sandbox.add('allow-same-origin', 'allow-scripts', 'allow-modals');
      
      document.body.appendChild(iframe);
      
      // Write HTML content to iframe
      iframe.contentDocument?.open();
      iframe.contentDocument?.write(html);
      iframe.contentDocument?.close();
      
      // Wait for content to load then print
      iframe.onload = () => {
        iframe.contentWindow?.print();
        
        // Remove iframe after print dialog closes
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      };
    } catch (err) {
      console.error('Print failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handlePrint}
      disabled={loading}
      title="Print resume"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Printer className="h-3.5 w-3.5" />
      )}
      {loading ? 'Preparing…' : 'Print'}
    </Button>
  );
}
