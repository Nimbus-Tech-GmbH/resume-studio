import type { JsonResumeSkill } from '@resume-studio/transformer';
import { useEditorStore } from '../../state/editorStore.js';
import { TextField, KeywordsField } from '../fields/Fields.js';
import { SortableList } from '../SortableList.js';
import { AddButton, RemoveButton } from '../fields/ListButtons.js';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card.js';
import { GripVertical } from 'lucide-react';

const EMPTY: never[] = [];

export function SkillsForm() {
  const raw = useEditorStore((s) => s.resume.skills);
  const items = raw ?? EMPTY;
  const patch = useEditorStore((s) => s.patchResume);
  const addItem = useEditorStore((s) => s.addItem);
  const removeItem = useEditorStore((s) => s.removeItem);
  const reorderItems = useEditorStore((s) => s.reorderItems);

  const update = (idx: number, next: JsonResumeSkill) =>
    patch((r) => ({
      ...r,
      skills: (r.skills ?? []).map((it, i) => (i === idx ? next : it)),
    }));

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No skills yet.</p>
      ) : (
        <SortableList
          items={items}
          getId={(_item, i) => String(i)}
          onReorder={(_next, from, to) => reorderItems('skills', from, to)}
          renderItem={(item, idx, handle) => (
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-3">
                <div className="flex items-center gap-1">
                  {handle}
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardTitle className="flex-1 text-xs font-medium">
                  {item.name || `Skill #${idx + 1}`}
                </CardTitle>
                <RemoveButton onClick={() => removeItem('skills', idx)} />
              </CardHeader>
              <CardContent className="space-y-3 p-3 pt-0">
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="Name"
                    value={item.name}
                    onChange={(v) => update(idx, { ...item, name: v })}
                  />
                  <TextField
                    label="Level"
                    value={item.level}
                    onChange={(v) => update(idx, { ...item, level: v })}
                  />
                </div>
                <KeywordsField
                  label="Keywords"
                  value={item.keywords}
                  onChange={(v) => update(idx, { ...item, keywords: v })}
                />
              </CardContent>
            </Card>
          )}
        />
      )}
      <AddButton
        label="Add skill"
        onClick={() => addItem('skills', {} as JsonResumeSkill)}
      />
    </div>
  );
}
