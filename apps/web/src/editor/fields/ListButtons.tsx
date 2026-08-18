import { Button } from '../../components/ui/button.js';
import { Plus, X } from 'lucide-react';

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button size="sm" variant="outline" onClick={onClick} className="gap-1">
      <Plus className="h-3 w-3" />
      {label}
    </Button>
  );
}

export function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={onClick}
      aria-label="Remove item"
      title="Remove"
      className="h-6 w-6"
    >
      <X className="h-3 w-3" />
    </Button>
  );
}
