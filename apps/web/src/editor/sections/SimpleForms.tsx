import type {
  JsonResumeCertificate,
  JsonResumeInterest,
  JsonResumeLanguage,
  JsonResumeProject,
  JsonResumeVolunteer,
} from '@resume-studio/transformer';
import type { ReactNode } from 'react';
import { useEditorStore } from '../../state/editorStore.js';
import { TextField, KeywordsField, TextAreaField } from '../fields/Fields.js';
import { AddButton, RemoveButton } from '../fields/ListButtons.js';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card.js';

const EMPTY: never[] = [];

function List<T>({
  section,
  items,
  empty,
  addLabel,
  onAdd,
  onRemove,
  title,
  render,
}: {
  section: string;
  items: T[];
  empty: string;
  addLabel: string;
  onAdd: () => void;
  onRemove: (i: number) => void;
  title: (it: T, i: number) => string;
  render: (item: T, idx: number) => ReactNode;
}) {
  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        items.map((item, idx) => (
          <Card key={idx}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
              <CardTitle className="text-xs font-medium">{title(item, idx)}</CardTitle>
              <RemoveButton onClick={() => onRemove(idx)} />
            </CardHeader>
            <CardContent className="space-y-3 p-3 pt-0">{render(item, idx)}</CardContent>
          </Card>
        ))
      )}
      <AddButton label={addLabel} onClick={onAdd} />
    </div>
  );
}

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
          <KeywordsField
            label="Keywords"
            value={item.keywords}
            onChange={(v) => update(idx, { ...item, keywords: v })}
          />
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
          <TextAreaField
            label="Summary"
            value={item.summary}
            onChange={(v) => update(idx, { ...item, summary: v })}
          />
          <KeywordsField
            label="Highlights"
            value={item.highlights}
            onChange={(v) => update(idx, { ...item, highlights: v })}
          />
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
          <TextAreaField
            label="Description"
            value={item.description}
            onChange={(v) => update(idx, { ...item, description: v })}
          />
          <KeywordsField
            label="Highlights"
            value={item.highlights}
            onChange={(v) => update(idx, { ...item, highlights: v })}
          />
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
              label="URL"
              type="url"
              value={item.url}
              onChange={(v) => update(idx, { ...item, url: v })}
            />
          </div>
          <TextAreaField
            label="Summary"
            value={item.summary}
            onChange={(v) => update(idx, { ...item, summary: v })}
          />
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
