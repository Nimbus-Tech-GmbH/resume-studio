import type { ChangeEvent } from "react"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const UNSET = "__unset__"

interface BaseProps {
  label: string
  value: string | undefined
  onChange: (next: string) => void
  placeholder?: string
  error?: string | null
  type?: "text" | "email" | "url" | "tel" | "date"
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  error,
  type = "text",
}: BaseProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label>{label}</Label>

      <Input
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.value)
        }
      />

      {error && <p className="text-destructive">{error}</p>}
    </div>
  )
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: BaseProps & { rows?: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label>{label}</Label>

      <Textarea
        value={value ?? ""}
        placeholder={placeholder}
        rows={rows}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
          onChange(event.target.value)
        }
      />
    </div>
  )
}

interface SelectFieldProps {
  label: string
  value: string | undefined
  options: readonly string[]
  onChange: (next: string) => void
  placeholder?: string
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
}: SelectFieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label>{label}</Label>

      <Select
        value={value ?? ""}
        onValueChange={(newValue) =>
          onChange(newValue === UNSET ? "" : newValue)
        }
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder ?? "Select…"} />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value={UNSET}>
            {placeholder ?? "— None —"}
          </SelectItem>

          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

interface KeywordsFieldProps {
  label: string
  value: string[] | undefined
  onChange: (next: string[]) => void
  placeholder?: string
}

export function KeywordsField({
  label,
  value,
  onChange,
  placeholder,
}: KeywordsFieldProps) {
  const items = value ?? []

  const remove = (index: number) =>
    onChange(items.filter((_, itemIndex) => itemIndex !== index))

  const add = (raw: string) => {
    const parts = raw
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean)

    if (parts.length === 0) {
      return
    }

    onChange([...items, ...parts])
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label>{label}</Label>

      <div className="flex min-h-9 min-w-0 flex-wrap items-center gap-2 rounded-lg border border-input bg-transparent px-3 py-2">
        {items.map((item, index) => (
          <Badge
            key={`${item}-${index}`}
            variant="secondary"
            className="shrink gap-1"
          >
            <span className="truncate">{item}</span>

            <button
              type="button"
              onClick={() => remove(index)}
              className="shrink-0 rounded-full text-muted-foreground hover:text-destructive"
              aria-label={`Remove ${item}`}
            >
              ×
            </button>
          </Badge>
        ))}

        <input
          type="text"
          placeholder={placeholder ?? "Add…"}
          className="min-w-[8ch] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault()

              const target = event.currentTarget

              add(target.value)
              target.value = ""
            } else if (
              event.key === "Backspace" &&
              !event.currentTarget.value &&
              items.length
            ) {
              remove(items.length - 1)
            }
          }}
          onBlur={(event) => {
            if (event.currentTarget.value) {
              add(event.currentTarget.value)
              event.currentTarget.value = ""
            }
          }}
        />
      </div>
    </div>
  )
}
