import { LRUCache } from 'lru-cache';

function safeCacheMax(fallback: number): number {
  const raw = process.env.RENDER_CACHE_MAX;
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

const MAX = safeCacheMax(100);

export const htmlCache = new LRUCache<string, string>({
  max: MAX,
  ttl: 1000 * 60 * 15,
});
