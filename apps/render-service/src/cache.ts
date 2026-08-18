import { LRUCache } from 'lru-cache';

const MAX = Number(process.env.RENDER_CACHE_MAX ?? 100);

export const htmlCache = new LRUCache<string, string>({
  max: MAX,
  ttl: 1000 * 60 * 15,
});
