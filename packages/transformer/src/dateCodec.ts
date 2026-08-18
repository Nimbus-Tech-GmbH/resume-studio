/**
 * Date codec: JSON Resume uses YYYY-MM-DD (or YYYY-MM); CMS uses ISO DateTime.
 * Invalid dates return null so callers can block Save with inline error.
 */

const DATE_ONLY = /^\d{4}-\d{2}(-\d{2})?$/;

export function decodeDate(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

export function encodeDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (DATE_ONLY.test(trimmed)) {
    const iso = trimmed.length === 7 ? `${trimmed}-01` : trimmed;
    const d = new Date(`${iso}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function isValidDateInput(input: string | null | undefined): boolean {
  if (!input) return true;
  return encodeDate(input) !== null;
}
