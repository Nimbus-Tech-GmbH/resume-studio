import type { JsonResumeWork } from '@resume-studio/transformer';
import { useEditorStore } from '../../state/editorStore.js';
import { TextAreaField, TextField } from '../fields/Fields.js';
import { SortableList } from '../SortableList.js';
import { AddButton, RemoveButton } from '../fields/ListButtons.js';

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
    <div className="flex flex-col gap-3">
      {work.length === 0 ? (
        <EmptyState label="No work experience yet." />
      ) : (
        <SortableList
          items={work}
          getId={(_item, i) => String(i)}
          onReorder={(_next, from, to) => reorderItems('work', from, to)}
          renderItem={(item, idx, handle) => (
            <div className="rounded border border-neutral-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500">
                  {item.name || item.position || `Work #${idx + 1}`}
                </span>
                <div className="flex items-center gap-1">
                  {handle}
                  <RemoveButton onClick={() => removeItem('work', idx)} />
                </div>
              </div>
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
              <div className="mt-3">
                <TextAreaField
                  label="Summary"
                  value={item.summary}
                  onChange={(v) => update(idx, { ...item, summary: v })}
                />
              </div>
              <HighlightsEditor
                highlights={item.highlights ?? []}
                onChange={(next) => update(idx, { ...item, highlights: next })}
              />
            </div>
          )}
        />
      )}
      <AddButton
        label="+ Add work"
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
  return (
    <div className="mt-3">
      <span className="mb-1 block text-xs font-medium text-neutral-600">Highlights</span>
      <ul className="flex flex-col gap-1">
        {highlights.map((h, i) => (
          <li key={i} className="flex gap-1">
            <input
              value={h}
              onChange={(e) =>
                onChange(highlights.map((v, j) => (j === i ? e.target.value : v)))
              }
              className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-200"
            />
            <button
              type="button"
              onClick={() => onChange(highlights.filter((_, j) => j !== i))}
              className="rounded px-2 text-xs text-neutral-500 hover:bg-red-50 hover:text-red-600"
              aria-label="Remove highlight"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onChange([...highlights, ''])}
        className="mt-1 rounded border border-dashed border-neutral-300 px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-50"
      >
        + Add highlight
      </button>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="rounded border border-dashed border-neutral-300 p-4 text-center text-xs text-neutral-500">
      {label}
    </p>
  );
}
