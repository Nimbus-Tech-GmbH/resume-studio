/**
 * Render service environment variables.
 */

function safePort(fallback: number): number {
  const raw = process.env.RENDER_PORT;
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 65535) {
    throw new Error(`Invalid RENDER_PORT: ${raw}`);
  }
  return n;
}

export const env = {
  RENDER_PORT: safePort(5173),
  RENDER_HOST: process.env.RENDER_HOST ?? '0.0.0.0',
  RENDER_CORS_ORIGIN: (process.env.RENDER_CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  RENDER_ALLOWED_IPS: process.env.RENDER_ALLOWED_IPS
    ? process.env.RENDER_ALLOWED_IPS.split(',').map((s) => s.trim()).filter(Boolean)
    : [],
  AUTH_TARGET: process.env.AUTH_TARGET ?? 'http://127.0.0.1:4000',
  OPENCODE_TARGET: process.env.OPENCODE_TARGET ?? 'https://opencode.ai',
} as const;
