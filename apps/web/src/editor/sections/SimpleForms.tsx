import type {
  JsonResumeCertificate,
  JsonResumeInterest,
  JsonResumeLanguage,
  JsonResumeProject,
  JsonResumeVolunteer,
} from '@resume-studio/transformer';
import type { ReactNode } from 'react';
import { useEditorStore } from '../../state/editorStore.js';
import { TextField, SelectField, KeywordsField, TextAreaField } from '../fields/Fields.js';
import { HighlightsEditor } from '../fields/HighlightsEditor.js';
import { FLUENCY_LEVELS } from '@resume-studio/transformer';
import { AddButton, RemoveButton } from '../fields/ListButtons.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.js';

const EMPTY: never[] = [];

function List<T>({
  items,
  empty,
  addLabel,
  onAdd,
  onRemove,
  title,
  render,
}: {
  items: T[];
  empty: string;
  addLabel: string;
  onAdd: () => void;
  onRemove: (i: number) => void;
  title: (it: T, i: number) => string;
  render: (item: T, idx: number) => ReactNode;
}) {
  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">{empty}</p>
          </CardContent>
        </Card>
      ) : (
        items.map((item, idx) => (
          <Card key={idx}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
              <CardTitle className="text-sm font-medium">{title(item, idx)}</CardTitle>
              <RemoveButton onClick={() => onRemove(idx)} />
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0">{render(item, idx)}</CardContent>
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
      items={items}
      empty="No volunteer entries yet."
      addLabel="+ Add volunteer"
      onAdd={() => addItem('volunteer', {} as JsonResumeVolunteer)}
      onRemove={(i) => removeItem('volunteer', i)}
      title={(it, i) => it.organization || `Volunteer #${i + 1}`}
      render={(item, idx) => (
        <>
          <div className="grid min-w-0 grid-cols-2 gap-4">
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
          <HighlightsEditor
            highlights={item.highlights ?? []}
            onChange={(next) => update(idx, { ...item, highlights: next })}
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
      items={items}
      empty="No projects yet."
      addLabel="+ Add project"
      onAdd={() => addItem('projects', {} as JsonResumeProject)}
      onRemove={(i) => removeItem('projects', i)}
      title={(it, i) => it.name || `Project #${i + 1}`}
      render={(item, idx) => (
        <>
          <div className="grid min-w-0 grid-cols-2 gap-4">
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
          <HighlightsEditor
            highlights={item.highlights ?? []}
            onChange={(next) => update(idx, { ...item, highlights: next })}
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
      items={items}
      empty="No certificates yet."
      addLabel="+ Add certificate"
      onAdd={() => addItem('certificates', {} as JsonResumeCertificate)}
      onRemove={(i) => removeItem('certificates', i)}
      title={(it, i) => it.name || `Certificate #${i + 1}`}
      render={(item, idx) => (
        <>
          <div className="grid min-w-0 grid-cols-2 gap-4">
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
      items={items}
      empty="No languages yet."
      addLabel="+ Add language"
      onAdd={() => addItem('languages', {} as JsonResumeLanguage)}
      onRemove={(i) => removeItem('languages', i)}
      title={(it, i) => it.language || `Language #${i + 1}`}
      render={(item, idx) => (
        <div className="grid min-w-0 grid-cols-2 gap-4">
          <TextField
            label="Language"
            value={item.language}
            onChange={(v) => update(idx, { ...item, language: v })}
          />
          <SelectField
            label="Fluency"
            value={item.fluency}
            options={FLUENCY_LEVELS}
            onChange={(v) => update(idx, { ...item, fluency: v })}
          />
        </div>
      )}
    />
  );
}
