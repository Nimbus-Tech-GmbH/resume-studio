import type {
  JsonResumeCertificate,
  JsonResumeInterest,
  JsonResumeLanguage,
  JsonResumeProject,
  JsonResumeVolunteer,
} from '@resume-studio/transformer';
import { useEditorStore } from '../../state/editorStore.js';
import { KeywordsField, TextAreaField, TextField } from '../fields/Fields.js';

/**
 * Simple (non-DnD) forms for the smaller sections. Reordering these lands in
 * a follow-up — they are typically short and re-order less often.
 */

export function InterestsForm() {
  const interests = useEditorStore((s) => s.resume.interests ?? []);
  const patch = useEditorStore((s) => s.patchResume);
  const update = (idx: number, next: JsonResumeInterest) =>
    patch((r) => ({
      ...r,
      interests: (r.interests ?? []).map((it, i) => (i === idx ? next : it)),
    }));
  return (
    <List
      items={interests}
      empty="No interests yet."
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
  const items = useEditorStore((s) => s.resume.volunteer ?? []);
  const patch = useEditorStore((s) => s.patchResume);
  const update = (idx: number, next: JsonResumeVolunteer) =>
    patch((r) => ({
      ...r,
      volunteer: (r.volunteer ?? []).map((it, i) => (i === idx ? next : it)),
    }));
  return (
    <List
      items={items}
      empty="No volunteer entries yet."
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
  const items = useEditorStore((s) => s.resume.projects ?? []);
  const patch = useEditorStore((s) => s.patchResume);
  const update = (idx: number, next: JsonResumeProject) =>
    patch((r) => ({
      ...r,
      projects: (r.projects ?? []).map((it, i) => (i === idx ? next : it)),
    }));
  return (
    <List
      items={items}
      empty="No projects yet."
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
  const items = useEditorStore((s) => s.resume.certificates ?? []);
  const patch = useEditorStore((s) => s.patchResume);
  const update = (idx: number, next: JsonResumeCertificate) =>
    patch((r) => ({
      ...r,
      certificates: (r.certificates ?? []).map((it, i) => (i === idx ? next : it)),
    }));
  return (
    <List
      items={items}
      empty="No certificates yet."
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
  const items = useEditorStore((s) => s.resume.languages ?? []);
  const patch = useEditorStore((s) => s.patchResume);
  const update = (idx: number, next: JsonResumeLanguage) =>
    patch((r) => ({
      ...r,
      languages: (r.languages ?? []).map((it, i) => (i === idx ? next : it)),
    }));
  return (
    <List
      items={items}
      empty="No languages yet."
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
  items: T[];
  empty: string;
  title: (item: T, idx: number) => string;
  render: (item: T, idx: number) => React.ReactNode;
}

function List<T>({ items, empty, title, render }: ListProps<T>) {
  if (items.length === 0) {
    return (
      <p className="rounded border border-dashed border-neutral-300 p-4 text-center text-xs text-neutral-500">
        {empty}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, idx) => (
        <div key={idx} className="rounded border border-neutral-200 bg-white p-3">
          <span className="mb-2 block text-xs font-medium text-neutral-500">
            {title(item, idx)}
          </span>
          {render(item, idx)}
        </div>
      ))}
    </div>
  );
}
