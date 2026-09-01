"use client"

import * as React from "react"
import { format, parse } from "date-fns"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerSimpleProps {
  label?: string
  value?: string
  onChange: (next: string) => void
  placeholder?: string
}

const DATE_FORMAT = "yyyy-MM-dd"

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined
  const d = parse(value, DATE_FORMAT, new Date())
  return Number.isNaN(d.getTime()) ? undefined : d
}

export function DatePickerSimple({
  label = "Date",
  value,
  onChange,
  placeholder = "Pick a date",
}: DatePickerSimpleProps) {
  const date = parseDate(value)

  return (
    <Field className="w-full">
      <FieldLabel>{label}</FieldLabel>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start font-normal"
          >
            {date ? format(date, "PPP") : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => onChange(d ? format(d, DATE_FORMAT) : "")}
            defaultMonth={date}
          />
        </PopoverContent>
      </Popover>
    </Field>
  )
}
