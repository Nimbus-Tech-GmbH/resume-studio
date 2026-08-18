import type { JsonResumeWork } from '@resume-studio/transformer';
import { useEditorStore } from '../../state/editorStore.js';
import { TextAreaField, TextField } from '../fields/Fields.js';
import { SortableList } from '../SortableList.js';
import { AddButton, RemoveButton } from '../fields/ListButtons.js';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Label } from '../../components/ui/label.js';
import { GripVertical, Plus, X } from 'lucide-react';

const EMPTY: never[] = [];

export function WorkForm() {
  const workRaw = useEditorStore((s) => s.resume.work);
  const work = workRaw ?? EMPTY;
  const patch = useEditorStore((s) => s.patchResume);
  const addItem = useEditorStore((s) => s.addItem);
  const removeItem = useEditorStore((s) => s.removeItem);
  const reorderItems = useEditorStore((s) => s.reorderItems);

  const update = (idx: number, next: JsonResumeWork) =>
    patch((r) => ({
      ...r,
      work: (r.work ?? []).map((item, i) => (i === idx ? next : item)),
    }));

  return (
    <div className="space-y-3">
      {work.length === 0 ? (
        <p className="text-xs text-muted-foreground">No work experience yet.</p>
      ) : (
        <SortableList
          items={work}
          getId={(_item, i) => String(i)}
          onReorder={(_next, from, to) => reorderItems('work', from, to)}
          renderItem={(item, idx, handle) => (
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-3">
                <div className="flex items-center gap-1">
                  {handle}
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardTitle className="flex-1 text-xs font-medium">
                  {item.name || item.position || `Work #${idx + 1}`}
                </CardTitle>
                <RemoveButton onClick={() => removeItem('work', idx)} />
              </CardHeader>
              <CardContent className="space-y-3 p-3 pt-0">
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="Company"
                    value={item.name}
                    onChange={(v) => update(idx, { ...item, name: v })}
                  />
                  <TextField
                    label="Position"
                    value={item.position}
                    onChange={(v) => update(idx, { ...item, position: v })}
                  />
                  <TextField
                    label="URL"
                    type="url"
                    value={item.url}
                    onChange={(v) => update(idx, { ...item, url: v })}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      label="Start"
                      value={item.startDate}
                      placeholder="YYYY-MM-DD"
                      onChange={(v) => update(idx, { ...item, startDate: v })}
                    />
                    <TextField
                      label="End"
                      value={item.endDate}
                      placeholder="YYYY-MM-DD"
                      onChange={(v) => update(idx, { ...item, endDate: v })}
                    />
                  </div>
                </div>
                <TextAreaField
                  label="Summary"
                  value={item.summary}
                  onChange={(v) => update(idx, { ...item, summary: v })}
                />
                <HighlightsEditor
                  highlights={item.highlights ?? []}
                  onChange={(next) => update(idx, { ...item, highlights: next })}
                />
              </CardContent>
            </Card>
          )}
        />
      )}
      <AddButton
        label="Add work"
        onClick={() => addItem('work', {} as JsonResumeWork)}
      />
    </div>
  );
}

function HighlightsEditor({
  highlights,
  onChange,
}: {
  highlights: string[];
  onChange: (next: string[]) => void;
}) {
  const add = () => onChange([...highlights, '']);
  const remove = (i: number) => onChange(highlights.filter((_, idx) => idx !== i));
  const update = (i: number, v: string) =>
    onChange(highlights.map((h, idx) => (idx === i ? v : h)));

  return (
    <div className="space-y-2">
      <Label>Highlights</Label>
      {highlights.map((h, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={h}
            onChange={(e) => update(i, e.target.value)}
            placeholder="Describe achievement…"
          />
          <Button size="icon" variant="ghost" onClick={() => remove(i)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add}>
        <Plus className="h-3 w-3" />
        Add highlight
      </Button>
    </div>
  );
}
