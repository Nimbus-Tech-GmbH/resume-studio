import type { ChangeEvent } from 'react';
import { Input } from '../../components/ui/input.js';
import { Textarea } from '../../components/ui/textarea.js';
import { Label } from '../../components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select.js';
import { cn } from '../../lib/cn.js';

interface BaseProps {
  label: string;
  value: string | undefined;
  onChange: (next: string) => void;
  placeholder?: string;
  error?: string | null;
  type?: 'text' | 'email' | 'url' | 'tel' | 'date';
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  error,
  type = 'text',
}: BaseProps) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className={cn(error && 'border-destructive')}
      />
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: BaseProps & { rows?: number }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea
        value={value ?? ''}
        placeholder={placeholder}
        rows={rows}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      />
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string | undefined;
  options: readonly string[];
  onChange: (next: string) => void;
  placeholder?: string;
}

/** Dropdown bound to a CMS `select` option list. Empty value = unset. */
export function SelectField({ label, value, options, onChange, placeholder }: SelectFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select
        value={value ?? ''}
        onValueChange={(v) => onChange(v === UNSET ? '' : v)}
      >
        <SelectTrigger className="h-9 w-full text-sm">
          <SelectValue placeholder={placeholder ?? 'Select…'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNSET} className="text-muted-foreground">
            {placeholder ?? '— None —'}
          </SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const UNSET = '__unset__';

interface KeywordsFieldProps {
  label: string;
  value: string[] | undefined;
  onChange: (next: string[]) => void;
  placeholder?: string;
}

export function KeywordsField({ label, value, onChange, placeholder }: KeywordsFieldProps) {
  const items = value ?? [];
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const add = (raw: string) => {
    const parts = raw
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    onChange([...items, ...parts]);
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex min-h-[2.25rem] flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
        {items.map((item, idx) => (
          <span
            key={`${item}-${idx}`}
            className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[10px]"
          >
            {item}
            <button
              type="button"
              onClick={() => remove(idx)}
              className="text-muted-foreground hover:text-destructive"
              aria-label={`Remove ${item}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          placeholder={placeholder ?? 'Add…'}
          className="flex-1 min-w-[8ch] bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              const target = e.currentTarget;
              add(target.value);
              target.value = '';
            } else if (e.key === 'Backspace' && !e.currentTarget.value && items.length) {
              remove(items.length - 1);
            }
          }}
          onBlur={(e) => {
            if (e.currentTarget.value) {
              add(e.currentTarget.value);
              e.currentTarget.value = '';
            }
          }}
        />
      </div>
    </div>
  );
}
