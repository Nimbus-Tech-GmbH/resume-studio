import type { JsonResumeEducation } from '@resume-studio/transformer';
import { useEditorStore } from '../../state/editorStore.js';
import { KeywordsField, TextField } from '../fields/Fields.js';
import { SortableList } from '../SortableList.js';

export function EducationForm() {
  const education = useEditorStore((s) => s.resume.education ?? []);
  const patch = useEditorStore((s) => s.patchResume);

  const update = (idx: number, next: JsonResumeEducation) =>
    patch((r) => ({
      ...r,
      education: (r.education ?? []).map((item, i) => (i === idx ? next : item)),
    }));

  const reorder = (next: JsonResumeEducation[]) =>
    patch((r) => ({ ...r, education: next }));

  if (education.length === 0) {
    return (
      <p className="rounded border border-dashed border-neutral-300 p-4 text-center text-xs text-neutral-500">
        No education entries yet.
      </p>
    );
  }

  return (
    <SortableList
      items={education}
      getId={(_e, i) => String(i)}
      onReorder={reorder}
      renderItem={(item, idx, handle) => (
        <div className="rounded border border-neutral-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">
              {item.institution || `Education #${idx + 1}`}
            </span>
            {handle}
          </div>
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
              label="Score"
              value={item.score}
              onChange={(v) => update(idx, { ...item, score: v })}
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
          </div>
          <div className="mt-3">
            <KeywordsField
              label="Courses"
              value={item.courses}
              onChange={(v) => update(idx, { ...item, courses: v })}
            />
          </div>
        </div>
      )}
    />
  );
}
