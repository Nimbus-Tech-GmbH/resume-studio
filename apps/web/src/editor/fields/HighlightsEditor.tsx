import { useState } from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function HighlightsEditor({
  highlights,
  onChange,
}: {
  highlights: string[]
  onChange: (next: string[]) => void
}) {
  const [editIndex, setEditIndex] = useState<number | null>(null)

  const editing = editIndex === null ? undefined : highlights[editIndex]

  const remove = (index: number) =>
    onChange(highlights.filter((_, highlightIndex) => highlightIndex !== index))

  const commit = (value: string) => {
    if (editIndex === null) {
      return
    }

    const trimmed = value.trim()

    if (trimmed) {
      onChange(
        highlights.map((highlight, highlightIndex) =>
          highlightIndex === editIndex ? trimmed : highlight
        )
      )
    } else {
      onChange(
        highlights.filter(
          (_, highlightIndex) => highlightIndex !== editIndex
        )
      )
    }

    setEditIndex(null)
  }

  const add = () => {
    onChange([...highlights, ""])
    setEditIndex(highlights.length)
  }

  const close = () => {
    setEditIndex(null)
  }

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      close()
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label>Highlights</Label>

      <ul className="flex min-w-0 flex-wrap items-center gap-2">
        {highlights.map((highlight, index) => (
          <li key={index}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="cursor-pointer"
              title={highlight}
              onClick={() => setEditIndex(index)}
            >
              {index + 1}
            </Button>
          </li>
        ))}

        <li>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Add highlight"
            onClick={add}
          >
            <Plus />
          </Button>
        </li>
      </ul>

      <Dialog open={editIndex !== null} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit highlight {editIndex === null ? "" : editIndex + 1}
            </DialogTitle>

            <DialogDescription>
              Update the text or delete this highlight. Clearing the field also
              deletes it.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={editing ?? ""}
            rows={4}
            autoFocus
            placeholder="Describe achievement…"
            onChange={(event) => {
              if (editIndex === null) {
                return
              }

              onChange(
                highlights.map((highlight, highlightIndex) =>
                  highlightIndex === editIndex
                    ? event.target.value
                    : highlight
                )
              )
            }}
          />

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (editIndex !== null) {
                  remove(editIndex)
                }

                close()
              }}
            >
              Delete
            </Button>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>

              <Button type="button" onClick={() => commit(editing ?? "")}>
                Update
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
