import type { JsonResumeSkill } from '@resume-studio/transformer';
import { useEditorStore } from '../../state/editorStore.js';
import { KeywordsField, TextField } from '../fields/Fields.js';
import { SortableList } from '../SortableList.js';

export function SkillsForm() {
  const skills = useEditorStore((s) => s.resume.skills ?? []);
  const patch = useEditorStore((s) => s.patchResume);

  const update = (idx: number, next: JsonResumeSkill) =>
    patch((r) => ({
      ...r,
      skills: (r.skills ?? []).map((item, i) => (i === idx ? next : item)),
    }));

  const reorder = (next: JsonResumeSkill[]) => patch((r) => ({ ...r, skills: next }));

  if (skills.length === 0) {
    return (
      <p className="rounded border border-dashed border-neutral-300 p-4 text-center text-xs text-neutral-500">
        No skills yet.
      </p>
    );
  }

  return (
    <SortableList
      items={skills}
      getId={(_s, i) => String(i)}
      onReorder={reorder}
      renderItem={(item, idx, handle) => (
        <div className="rounded border border-neutral-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">
              {item.name || `Skill #${idx + 1}`}
            </span>
            {handle}
          </div>
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
          <div className="mt-3">
            <KeywordsField
              label="Keywords"
              value={item.keywords}
              onChange={(v) => update(idx, { ...item, keywords: v })}
            />
          </div>
        </div>
      )}
    />
  );
}
