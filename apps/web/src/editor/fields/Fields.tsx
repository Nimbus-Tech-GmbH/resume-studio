import type { ChangeEvent } from 'react';
import { clsx } from 'clsx';

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
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-neutral-600">{label}</span>
      <input
        type={type}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className={clsx(
          'rounded border px-2 py-1 text-sm outline-none focus:ring-2',
          error
            ? 'border-red-400 focus:ring-red-200'
            : 'border-neutral-300 focus:ring-blue-200',
        )}
      />
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </label>
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
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-neutral-600">{label}</span>
      <textarea
        value={value ?? ''}
        placeholder={placeholder}
        rows={rows}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
        className="rounded border border-neutral-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-200"
      />
    </label>
  );
}

interface KeywordsFieldProps {
  label: string;
  value: string[] | undefined;
  onChange: (next: string[]) => void;
  placeholder?: string;
}

/**
 * Comma / Enter separated tags. Displayed as chips; store as string[].
 */
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
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-neutral-600">{label}</span>
      <div className="flex flex-wrap gap-1 rounded border border-neutral-300 p-1">
        {items.map((item, idx) => (
          <span
            key={`${item}-${idx}`}
            className="flex items-center gap-1 rounded bg-neutral-100 px-2 py-0.5 text-xs"
          >
            {item}
            <button
              type="button"
              onClick={() => remove(idx)}
              className="text-neutral-400 hover:text-red-500"
              aria-label={`Remove ${item}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          placeholder={placeholder ?? 'Add…'}
          className="flex-1 min-w-[6ch] bg-transparent px-1 py-0.5 text-sm outline-none"
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
    </label>
  );
}
