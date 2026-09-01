import type { JsonResumeWork } from "@resume-studio/transformer"

import { useEditorStore } from "@/state/editorStore"
import { TextAreaField, TextField } from "@/editor/fields/Fields"
import { HighlightsEditor } from "@/editor/fields/HighlightsEditor"
import { SortableList } from "@/editor/SortableList"
import { DatePickerSimple } from "@/components/ui/datepicker"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AddButton, RemoveButton } from "@/editor/fields/ListButtons"

const EMPTY: never[] = []

export function WorkForm() {
  const workRaw = useEditorStore((state) => state.resume.work)
  const work = workRaw ?? EMPTY
  const patchResume = useEditorStore((state) => state.patchResume)
  const addItem = useEditorStore((state) => state.addItem)
  const removeItem = useEditorStore((state) => state.removeItem)
  const reorderItems = useEditorStore((state) => state.reorderItems)

  const update = (index: number, next: JsonResumeWork) =>
    patchResume((resume) => ({
      ...resume,
      work: (resume.work ?? []).map((item, itemIndex) =>
        itemIndex === index ? next : item
      ),
    }))

  return (
    <div className="space-y-6">
      {work.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-muted-foreground">No work experience yet.</p>
          </CardContent>
        </Card>
      ) : (
        <SortableList
          items={work}
          getId={(_item, index) => String(index)}
          onReorder={(_next, fromIndex, toIndex) =>
            reorderItems("work", fromIndex, toIndex)
          }
          renderItem={(item, index, handle) => (
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {handle}

                  <CardTitle>
                    {item.name || item.position || `Work #${index + 1}`}
                  </CardTitle>
                </div>

                <RemoveButton onClick={() => removeItem("work", index)} />
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="Company"
                    value={item.name}
                    onChange={(value) =>
                      update(index, { ...item, name: value })
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

                  <div className="grid gap-4 sm:grid-cols-2">
                    <DatePickerSimple
                      label="Start"
                      value={item.startDate}
                      placeholder="YYYY-MM-DD"
                      onChange={(value) =>
                        update(index, { ...item, startDate: value })
                      }
                    />

                    <DatePickerSimple
                      label="End"
                      value={item.endDate}
                      placeholder="YYYY-MM-DD"
                      onChange={(value) =>
                        update(index, { ...item, endDate: value })
                      }
                    />
                  </div>
                </div>

                <TextAreaField
                  label="Summary"
                  value={item.summary}
                  onChange={(value) =>
                    update(index, { ...item, summary: value })
                  }
                />

                <HighlightsEditor
                  highlights={item.highlights ?? []}
                  onChange={(highlights) =>
                    update(index, { ...item, highlights })
                  }
                />
              </CardContent>
            </Card>
          )}
        />
      )}

      <div className="flex justify-end p-4">
        <AddButton
          label="Add work"
          onClick={() => addItem("work", {} as JsonResumeWork)}
        />
      </div>
    </div>
  )
}
