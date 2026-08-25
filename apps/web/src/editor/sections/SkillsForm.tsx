import type { JsonResumeSkill } from '@resume-studio/transformer';
import { useEditorStore } from '../../state/editorStore.js';
import { TextField, SelectField, KeywordsField } from '../fields/Fields.js';
import { SKILL_LEVELS } from '@resume-studio/transformer';
import { SortableList } from '../SortableList.js';
import { AddButton, RemoveButton } from '../fields/ListButtons.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.js';

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
    <div className="space-y-4">
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-xs text-muted-foreground">No skills yet.</p>
          </CardContent>
        </Card>
      ) : (
        <SortableList
          items={items}
          getId={(_item, i) => String(i)}
          onReorder={(_next, from, to) => reorderItems('skills', from, to)}
          renderItem={(item, idx, handle) => (
            <Card>
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 p-4">
                {handle}
                <CardTitle className="flex-1 text-xs font-medium">
                  {item.name || `Skill #${idx + 1}`}
                </CardTitle>
                <RemoveButton onClick={() => removeItem('skills', idx)} />
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-0">
                <div className="grid grid-cols-2 gap-4">
                  <TextField
                    label="Name"
                    value={item.name}
                    onChange={(v) => update(idx, { ...item, name: v })}
                  />
                  <SelectField
                    label="Level"
                    value={item.level}
                    options={SKILL_LEVELS}
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
