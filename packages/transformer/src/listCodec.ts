/**
 * List codec: CMS stores string[] as delimited String.
 * Primary delimiter: ✌🏻 (victory hand, light skin tone).
 * Legacy delimiters (\n, then ,;) supported on decode.
 */

export const LIST_DELIMITER = '✌🏻';

export function encodeList(items: readonly string[] | null | undefined): string {
  if (!items || items.length === 0) return '';
  return items
    .map((s) => s.trim())
    .filter(Boolean)
    .join(LIST_DELIMITER);
}

export function decodeList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const primary = raw.split(LIST_DELIMITER);
  if (primary.length > 1) return trimNonEmpty(primary);
  const byNewline = raw.split(/\r?\n/);
  if (byNewline.length > 1) return trimNonEmpty(byNewline);
  return trimNonEmpty(raw.split(/[,;]/));
}

function trimNonEmpty(parts: string[]): string[] {
  const out: string[] = [];
  for (const p of parts) {
    const t = p.trim();
    if (t) out.push(t);
  }
  return out;
}
