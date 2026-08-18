import type {
  JsonResumeCertificate,
  JsonResumeInterest,
  JsonResumeLanguage,
  JsonResumeProject,
  JsonResumeVolunteer,
} from '@resume-studio/transformer';
import type { ReactNode } from 'react';
import type { ListSection } from '../../state/editorStore.js';
import { useEditorStore } from '../../state/editorStore.js';
import { KeywordsField, TextAreaField, TextField } from '../fields/Fields.js';
import { AddButton, RemoveButton } from '../fields/ListButtons.js';

/**
 * Simple (non-DnD) forms for the smaller sections. Reordering these lands in
 * a follow-up — they are typically short and re-order less often.
 */

const EMPTY: never[] = [];

export function InterestsForm() {
  const raw = useEditorStore((s) => s.resume.interests);
  const interests = raw ?? EMPTY;
  const patch = useEditorStore((s) => s.patchResume);
  const addItem = useEditorStore((s) => s.addItem);
  const removeItem = useEditorStore((s) => s.removeItem);
  const update = (idx: number, next: JsonResumeInterest) =>
    patch((r) => ({
      ...r,
      interests: (r.interests ?? []).map((it, i) => (i === idx ? next : it)),
    }));
  return (
    <List
      section="interests"
      items={interests}
      empty="No interests yet."
      addLabel="+ Add interest"
      onAdd={() => addItem('interests', {} as JsonResumeInterest)}
      onRemove={(i) => removeItem('interests', i)}
      title={(it, i) => it.name || `Interest #${i + 1}`}
      render={(item, idx) => (
        <>
          <TextField
            label="Name"
            value={item.name}
            onChange={(v) => update(idx, { ...item, name: v })}
          />
          <div className="mt-3">
            <KeywordsField
              label="Keywords"
              value={item.keywords}
              onChange={(v) => update(idx, { ...item, keywords: v })}
            />
          </div>
        </>
      )}
    />
  );
}

export function VolunteerForm() {
  const raw = useEditorStore((s) => s.resume.volunteer);
  const items = raw ?? EMPTY;
  const patch = useEditorStore((s) => s.patchResume);
  const addItem = useEditorStore((s) => s.addItem);
  const removeItem = useEditorStore((s) => s.removeItem);
  const update = (idx: number, next: JsonResumeVolunteer) =>
    patch((r) => ({
      ...r,
      volunteer: (r.volunteer ?? []).map((it, i) => (i === idx ? next : it)),
    }));
  return (
    <List
      section="volunteer"
      items={items}
      empty="No volunteer entries yet."
      addLabel="+ Add volunteer"
      onAdd={() => addItem('volunteer', {} as JsonResumeVolunteer)}
      onRemove={(i) => removeItem('volunteer', i)}
      title={(it, i) => it.organization || `Volunteer #${i + 1}`}
      render={(item, idx) => (
        <>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Organization"
              value={item.organization}
              onChange={(v) => update(idx, { ...item, organization: v })}
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
            <TextAreaField
              label="Summary"
              value={item.summary}
              onChange={(v) => update(idx, { ...item, summary: v })}
            />
          </div>
          <div className="mt-3">
            <KeywordsField
              label="Highlights"
              value={item.highlights}
              onChange={(v) => update(idx, { ...item, highlights: v })}
            />
          </div>
        </>
      )}
    />
  );
}

export function ProjectsForm() {
  const raw = useEditorStore((s) => s.resume.projects);
  const items = raw ?? EMPTY;
  const patch = useEditorStore((s) => s.patchResume);
  const addItem = useEditorStore((s) => s.addItem);
  const removeItem = useEditorStore((s) => s.removeItem);
  const update = (idx: number, next: JsonResumeProject) =>
    patch((r) => ({
      ...r,
      projects: (r.projects ?? []).map((it, i) => (i === idx ? next : it)),
    }));
  return (
    <List
      section="projects"
      items={items}
      empty="No projects yet."
      addLabel="+ Add project"
      onAdd={() => addItem('projects', {} as JsonResumeProject)}
      onRemove={(i) => removeItem('projects', i)}
      title={(it, i) => it.name || `Project #${i + 1}`}
      render={(item, idx) => (
        <>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Name"
              value={item.name}
              onChange={(v) => update(idx, { ...item, name: v })}
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
          </div>
          <div className="mt-3">
            <TextAreaField
              label="Description"
              value={item.description}
              onChange={(v) => update(idx, { ...item, description: v })}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <KeywordsField
              label="Highlights"
              value={item.highlights}
              onChange={(v) => update(idx, { ...item, highlights: v })}
            />
            <KeywordsField
              label="Keywords"
              value={item.keywords}
              onChange={(v) => update(idx, { ...item, keywords: v })}
            />
          </div>
        </>
      )}
    />
  );
}

export function CertificatesForm() {
  const raw = useEditorStore((s) => s.resume.certificates);
  const items = raw ?? EMPTY;
  const patch = useEditorStore((s) => s.patchResume);
  const addItem = useEditorStore((s) => s.addItem);
  const removeItem = useEditorStore((s) => s.removeItem);
  const update = (idx: number, next: JsonResumeCertificate) =>
    patch((r) => ({
      ...r,
      certificates: (r.certificates ?? []).map((it, i) => (i === idx ? next : it)),
    }));
  return (
    <List
      section="certificates"
      items={items}
      empty="No certificates yet."
      addLabel="+ Add certificate"
      onAdd={() => addItem('certificates', {} as JsonResumeCertificate)}
      onRemove={(i) => removeItem('certificates', i)}
      title={(it, i) => it.name || `Certificate #${i + 1}`}
      render={(item, idx) => (
        <>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Name"
              value={item.name}
              onChange={(v) => update(idx, { ...item, name: v })}
            />
            <TextField
              label="Issuer"
              value={item.issuer}
              onChange={(v) => update(idx, { ...item, issuer: v })}
            />
            <TextField
              label="URL"
              type="url"
              value={item.url}
              onChange={(v) => update(idx, { ...item, url: v })}
            />
            <TextField
              label="Date"
              value={item.date}
              placeholder="YYYY-MM-DD"
              onChange={(v) => update(idx, { ...item, date: v })}
            />
          </div>
          <div className="mt-3">
            <TextAreaField
              label="Summary"
              value={item.summary}
              onChange={(v) => update(idx, { ...item, summary: v })}
            />
          </div>
        </>
      )}
    />
  );
}

export function LanguagesForm() {
  const raw = useEditorStore((s) => s.resume.languages);
  const items = raw ?? EMPTY;
  const patch = useEditorStore((s) => s.patchResume);
  const addItem = useEditorStore((s) => s.addItem);
  const removeItem = useEditorStore((s) => s.removeItem);
  const update = (idx: number, next: JsonResumeLanguage) =>
    patch((r) => ({
      ...r,
      languages: (r.languages ?? []).map((it, i) => (i === idx ? next : it)),
    }));
  return (
    <List
      section="languages"
      items={items}
      empty="No languages yet."
      addLabel="+ Add language"
      onAdd={() => addItem('languages', {} as JsonResumeLanguage)}
      onRemove={(i) => removeItem('languages', i)}
      title={(it, i) => it.language || `Language #${i + 1}`}
      render={(item, idx) => (
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Language"
            value={item.language}
            onChange={(v) => update(idx, { ...item, language: v })}
          />
          <TextField
            label="Fluency"
            value={item.fluency}
            onChange={(v) => update(idx, { ...item, fluency: v })}
          />
        </div>
      )}
    />
  );
}

interface ListProps<T> {
  section: ListSection;
  items: T[];
  empty: string;
  addLabel: string;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  title: (item: T, idx: number) => string;
  render: (item: T, idx: number) => ReactNode;
}

function List<T>({ items, empty, addLabel, onAdd, onRemove, title, render }: ListProps<T>) {
  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-300 p-4 text-center text-xs text-neutral-500">
          {empty}
        </p>
      ) : (
        items.map((item, idx) => (
          <div key={idx} className="rounded border border-neutral-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-500">
                {title(item, idx)}
              </span>
              <RemoveButton onClick={() => onRemove(idx)} />
            </div>
            {render(item, idx)}
          </div>
        ))
      )}
      <AddButton label={addLabel} onClick={onAdd} />
    </div>
  );
}
