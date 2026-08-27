import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button size="sm" variant="outline" onClick={onClick} className="gap-1.5">
      <Plus className="h-3.5 w-3.5" />
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
      className="h-7 w-7"
    >
      <X className="h-3.5 w-3.5" />
    </Button>
  );
}
