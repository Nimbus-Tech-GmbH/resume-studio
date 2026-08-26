import type { ChangeEvent } from 'react';
import { Input } from '../../components/ui/input.js';
import { Textarea } from '../../components/ui/textarea.js';
import { Label } from '../../components/ui/label.js';
import { Badge } from '../../components/ui/badge.js';
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
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className={cn('h-8 text-sm', error && 'border-destructive')}
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
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Textarea
        value={value ?? ''}
        placeholder={placeholder}
        rows={rows}
        className="text-sm"
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
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Select
        value={value ?? ''}
        onValueChange={(v) => onChange(v === UNSET ? '' : v)}
      >
        <SelectTrigger className="h-8 w-full min-w-0 text-sm">
          <SelectValue placeholder={placeholder ?? 'Select…'} />
        </SelectTrigger>
        <SelectContent className="text-sm">
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
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex min-h-[2rem] min-w-0 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1 dark:bg-input/30">
        {items.map((item, idx) => (
          <Badge
            key={`${item}-${idx}`}
            variant="secondary"
            className="max-w-full shrink gap-0.5 pr-0.5 text-[10px]"
          >
            <span className="truncate">{item}</span>
            <button
              type="button"
              onClick={() => remove(idx)}
              className="shrink-0 rounded-full text-muted-foreground hover:text-destructive"
              aria-label={`Remove ${item}`}
            >
              ×
            </button>
          </Badge>
        ))}
        <input
          type="text"
          placeholder={placeholder ?? 'Add…'}
          className="min-w-[8ch] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
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
