import type {
  JsonResumeCertificate,
  JsonResumeInterest,
  JsonResumeLanguage,
  JsonResumeProject,
  JsonResumeVolunteer,
} from "@resume-studio/transformer"
import { FLUENCY_LEVELS } from "@resume-studio/transformer"
import type { ReactNode } from "react"

import { useEditorStore } from "@/state/editorStore"
import {
  KeywordsField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/editor/fields/Fields"
import { HighlightsEditor } from "@/editor/fields/HighlightsEditor"
import { AddButton, RemoveButton } from "@/editor/fields/ListButtons"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const EMPTY: never[] = []

function List<T>({
  items,
  empty,
  addLabel,
  onAdd,
  onRemove,
  title,
  render,
}: {
  items: T[]
  empty: string
  addLabel: string
  onAdd: () => void
  onRemove: (index: number) => void
  title: (item: T, index: number) => string
  render: (item: T, index: number) => ReactNode
}) {
  return (
    <div className="space-y-6">
      {items.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-muted-foreground">{empty}</p>
          </CardContent>
        </Card>
      ) : (
        items.map((item, index) => (
          <Card key={index}>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>{title(item, index)}</CardTitle>
              <RemoveButton onClick={() => onRemove(index)} />
            </CardHeader>

            <CardContent className="space-y-4">
              {render(item, index)}
            </CardContent>
          </Card>
        ))
      )}
      <div className="flex justify-end p-4">
        <AddButton label={addLabel} onClick={onAdd} />
      </div>
    </div>
  )
}

export function InterestsForm() {
  const interests = useEditorStore((state) => state.resume.interests) ?? EMPTY
  const patchResume = useEditorStore((state) => state.patchResume)
  const addItem = useEditorStore((state) => state.addItem)
  const removeItem = useEditorStore((state) => state.removeItem)

  const update = (index: number, next: JsonResumeInterest) =>
    patchResume((resume) => ({
      ...resume,
      interests: (resume.interests ?? []).map((item, itemIndex) =>
        itemIndex === index ? next : item
      ),
    }))

  return (
    <List
      items={interests}
      empty="No interests yet."
      addLabel="Add interest"
      onAdd={() => addItem("interests", {} as JsonResumeInterest)}
      onRemove={(index) => removeItem("interests", index)}
      title={(item, index) => item.name || `Interest #${index + 1}`}
      render={(item, index) => (
        <>
          <TextField
            label="Name"
            value={item.name}
            onChange={(value) => update(index, { ...item, name: value })}
          />

          <KeywordsField
            label="Keywords"
            value={item.keywords}
            onChange={(value) =>
              update(index, { ...item, keywords: value })
            }
          />
        </>
      )}
    />
  )
}

export function VolunteerForm() {
  const items = useEditorStore((state) => state.resume.volunteer) ?? EMPTY
  const patchResume = useEditorStore((state) => state.patchResume)
  const addItem = useEditorStore((state) => state.addItem)
  const removeItem = useEditorStore((state) => state.removeItem)

  const update = (index: number, next: JsonResumeVolunteer) =>
    patchResume((resume) => ({
      ...resume,
      volunteer: (resume.volunteer ?? []).map((item, itemIndex) =>
        itemIndex === index ? next : item
      ),
    }))

  return (
    <List
      items={items}
      empty="No volunteer entries yet."
      addLabel="Add volunteer"
      onAdd={() => addItem("volunteer", {} as JsonResumeVolunteer)}
      onRemove={(index) => removeItem("volunteer", index)}
      title={(item, index) =>
        item.organization || `Volunteer #${index + 1}`
      }
      render={(item, index) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Organization"
              value={item.organization}
              onChange={(value) =>
                update(index, { ...item, organization: value })
              }
            />

            <TextField
              label="Position"
              value={item.position}
              onChange={(value) =>
                update(index, { ...item, position: value })
              }
            />

            <TextField
              label="URL"
              type="url"
              value={item.url}
              onChange={(value) => update(index, { ...item, url: value })}
            />

            <TextField
              label="Start"
              value={item.startDate}
              placeholder="YYYY-MM-DD"
              onChange={(value) =>
                update(index, { ...item, startDate: value })
              }
            />

            <TextField
              label="End"
              value={item.endDate}
              placeholder="YYYY-MM-DD"
              onChange={(value) =>
                update(index, { ...item, endDate: value })
              }
            />
          </div>

          <TextAreaField
            label="Summary"
            value={item.summary}
            onChange={(value) => update(index, { ...item, summary: value })}
          />

          <HighlightsEditor
            highlights={item.highlights ?? []}
            onChange={(highlights) =>
              update(index, { ...item, highlights })
            }
          />
        </>
      )}
    />
  )
}

export function ProjectsForm() {
  const items = useEditorStore((state) => state.resume.projects) ?? EMPTY
  const patchResume = useEditorStore((state) => state.patchResume)
  const addItem = useEditorStore((state) => state.addItem)
  const removeItem = useEditorStore((state) => state.removeItem)

  const update = (index: number, next: JsonResumeProject) =>
    patchResume((resume) => ({
      ...resume,
      projects: (resume.projects ?? []).map((item, itemIndex) =>
        itemIndex === index ? next : item
      ),
    }))

  return (
    <List
      items={items}
      empty="No projects yet."
      addLabel="Add project"
      onAdd={() => addItem("projects", {} as JsonResumeProject)}
      onRemove={(index) => removeItem("projects", index)}
      title={(item, index) => item.name || `Project #${index + 1}`}
      render={(item, index) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Name"
              value={item.name}
              onChange={(value) => update(index, { ...item, name: value })}
            />

            <TextField
              label="URL"
              type="url"
              value={item.url}
              onChange={(value) => update(index, { ...item, url: value })}
            />

            <TextField
              label="Start"
              value={item.startDate}
              placeholder="YYYY-MM-DD"
              onChange={(value) =>
                update(index, { ...item, startDate: value })
              }
            />

            <TextField
              label="End"
              value={item.endDate}
              placeholder="YYYY-MM-DD"
              onChange={(value) =>
                update(index, { ...item, endDate: value })
              }
            />
          </div>

          <TextAreaField
            label="Description"
            value={item.description}
            onChange={(value) =>
              update(index, { ...item, description: value })
            }
          />

          <HighlightsEditor
            highlights={item.highlights ?? []}
            onChange={(highlights) =>
              update(index, { ...item, highlights })
            }
          />
        </>
      )}
    />
  )
}

export function CertificatesForm() {
  const items = useEditorStore((state) => state.resume.certificates) ?? EMPTY
  const patchResume = useEditorStore((state) => state.patchResume)
  const addItem = useEditorStore((state) => state.addItem)
  const removeItem = useEditorStore((state) => state.removeItem)

  const update = (index: number, next: JsonResumeCertificate) =>
    patchResume((resume) => ({
      ...resume,
      certificates: (resume.certificates ?? []).map((item, itemIndex) =>
        itemIndex === index ? next : item
      ),
    }))

  return (
    <List
      items={items}
      empty="No certificates yet."
      addLabel="Add certificate"
      onAdd={() => addItem("certificates", {} as JsonResumeCertificate)}
      onRemove={(index) => removeItem("certificates", index)}
      title={(item, index) => item.name || `Certificate #${index + 1}`}
      render={(item, index) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Name"
              value={item.name}
              onChange={(value) => update(index, { ...item, name: value })}
            />

            <TextField
              label="URL"
              type="url"
              value={item.url}
              onChange={(value) => update(index, { ...item, url: value })}
            />
          </div>

          <TextAreaField
            label="Summary"
            value={item.summary}
            onChange={(value) => update(index, { ...item, summary: value })}
          />
        </>
      )}
    />
  )
}

export function LanguagesForm() {
  const items = useEditorStore((state) => state.resume.languages) ?? EMPTY
  const patchResume = useEditorStore((state) => state.patchResume)
  const addItem = useEditorStore((state) => state.addItem)
  const removeItem = useEditorStore((state) => state.removeItem)

  const update = (index: number, next: JsonResumeLanguage) =>
    patchResume((resume) => ({
      ...resume,
      languages: (resume.languages ?? []).map((item, itemIndex) =>
        itemIndex === index ? next : item
      ),
    }))

  return (
    <List
      items={items}
      empty="No languages yet."
      addLabel="Add language"
      onAdd={() => addItem("languages", {} as JsonResumeLanguage)}
      onRemove={(index) => removeItem("languages", index)}
      title={(item, index) => item.language || `Language #${index + 1}`}
      render={(item, index) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Language"
            value={item.language}
            onChange={(value) =>
              update(index, { ...item, language: value })
            }
          />

          <SelectField
            label="Fluency"
            value={item.fluency}
            options={FLUENCY_LEVELS}
            onChange={(value) =>
              update(index, { ...item, fluency: value })
            }
          />
        </div>
      )}
    />
  )
}
