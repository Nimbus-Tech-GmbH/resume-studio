import type { JsonResumeEducation } from '@resume-studio/transformer';
import { useEditorStore } from '../../state/editorStore.js';
import { TextField, KeywordsField } from '../fields/Fields.js';
import { SortableList } from '../SortableList.js';
import { AddButton, RemoveButton } from '../fields/ListButtons.js';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card.js';
import { GripVertical } from 'lucide-react';

const EMPTY: never[] = [];

export function EducationForm() {
  const raw = useEditorStore((s) => s.resume.education);
  const items = raw ?? EMPTY;
  const patch = useEditorStore((s) => s.patchResume);
  const addItem = useEditorStore((s) => s.addItem);
  const removeItem = useEditorStore((s) => s.removeItem);
  const reorderItems = useEditorStore((s) => s.reorderItems);

  const update = (idx: number, next: JsonResumeEducation) =>
    patch((r) => ({
      ...r,
      education: (r.education ?? []).map((it, i) => (i === idx ? next : it)),
    }));

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No education entries yet.</p>
      ) : (
        <SortableList
          items={items}
          getId={(_item, i) => String(i)}
          onReorder={(_next, from, to) => reorderItems('education', from, to)}
          renderItem={(item, idx, handle) => (
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-3">
                <div className="flex items-center gap-1">
                  {handle}
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardTitle className="flex-1 text-xs font-medium">
                  {item.institution || item.area || `Education #${idx + 1}`}
                </CardTitle>
                <RemoveButton onClick={() => removeItem('education', idx)} />
              </CardHeader>
              <CardContent className="space-y-3 p-3 pt-0">
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="Institution"
                    value={item.institution}
                    onChange={(v) => update(idx, { ...item, institution: v })}
                  />
                  <TextField
                    label="Area"
                    value={item.area}
                    onChange={(v) => update(idx, { ...item, area: v })}
                  />
                  <TextField
                    label="Study type"
                    value={item.studyType}
                    onChange={(v) => update(idx, { ...item, studyType: v })}
                  />
                  <TextField
                    label="URL"
                    type="url"
                    value={item.url}
                    onChange={(v) => update(idx, { ...item, url: v })}
                  />
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
                  <TextField
                    label="Score"
                    value={item.score}
                    onChange={(v) => update(idx, { ...item, score: v })}
                  />
                </div>
                <KeywordsField
                  label="Courses"
                  value={item.courses}
                  onChange={(v) => update(idx, { ...item, courses: v })}
                />
              </CardContent>
            </Card>
          )}
        />
      )}
      <AddButton
        label="Add education"
        onClick={() => addItem('education', {} as JsonResumeEducation)}
      />
    </div>
  );
}
