import { useState } from 'react';
import { Button } from '../../components/ui/button.js';
import { Label } from '../../components/ui/label.js';
import { Textarea } from '../../components/ui/textarea.js';
import { Badge } from '../../components/ui/badge.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog.js';
import { Plus } from 'lucide-react';

export function HighlightsEditor({
  highlights,
  onChange,
}: {
  highlights: string[];
  onChange: (next: string[]) => void;
}) {
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const editing = editIndex !== null ? highlights[editIndex] : undefined;

  const remove = (i: number) => onChange(highlights.filter((_, idx) => idx !== i));
  const commit = (value: string) => {
    if (editIndex === null) return;
    const trimmed = value.trim();
    if (trimmed) {
      onChange(highlights.map((h, idx) => (idx === editIndex ? trimmed : h)));
    } else {
      // Empty text = delete the row.
      onChange(highlights.filter((_, idx) => idx !== editIndex));
    }
    setEditIndex(null);
  };
  const add = () => {
    onChange([...highlights, '']);
    setEditIndex(highlights.length);
  };

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label className="text-xs">Highlights</Label>
      <ul className="flex min-w-0 flex-wrap items-center gap-1.5">
        {highlights.map((h, i) => (
          <li key={i}>
            <Badge
              asChild
              variant="secondary"
              title={h}
              className="max-w-full cursor-pointer"
            >
              <button type="button" onClick={() => setEditIndex(i)}>
                <span className="truncate">{i + 1}</span>
              </button>
            </Badge>
          </li>
        ))}
        <li>
          <Badge asChild variant="outline" className="cursor-pointer">
            <button type="button" onClick={add} aria-label="Add highlight">
              <Plus />
            </button>
          </Badge>
        </li>
      </ul>

      <Dialog open={editIndex !== null} onOpenChange={(open) => !open && setEditIndex(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit highlight {editIndex !== null ? editIndex + 1 : ''}</DialogTitle>
            <DialogDescription>
              Update the text or delete this highlight. Clearing the field also deletes it.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={editing ?? ''}
            rows={4}
            autoFocus
            placeholder="Describe achievement…"
            onChange={(e) =>
              editIndex !== null &&
              onChange(highlights.map((h, idx) => (idx === editIndex ? e.target.value : h)))
            }
          />
          <div className="flex justify-between gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (editIndex !== null) remove(editIndex);
                setEditIndex(null);
              }}
            >
              Delete
            </Button>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditIndex(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => commit(editing ?? '')}>Update</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
