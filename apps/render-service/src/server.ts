import Fastify from 'fastify';
import cors from '@fastify/cors';
import { isThemeId } from '@resume-studio/themes';
import type { JsonResume } from '@resume-studio/transformer';
import { renderResume } from './render.js';
import { ipAllowlist } from './auth.js';

const PORT = Number(process.env.RENDER_PORT ?? 8787);
const HOST = process.env.RENDER_HOST ?? '127.0.0.1';
const CORS_ORIGIN = (process.env.RENDER_CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const ALLOWED_IPS = (process.env.RENDER_ALLOWED_IPS ?? '127.0.0.1,::1')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
});

app.addHook('onRequest', ipAllowlist(ALLOWED_IPS));

app.get('/health', async () => ({ ok: true }));

interface RenderBody {
  resume: JsonResume;
  theme: string;
}

app.post<{ Body: RenderBody }>('/render', async (req, reply) => {
  const { resume, theme } = req.body ?? ({} as RenderBody);
  if (!resume || typeof resume !== 'object') {
    return reply.code(400).send({ error: 'Missing resume body' });
  }
  if (!isThemeId(theme)) {
    return reply.code(400).send({ error: `Unknown theme: ${theme}` });
  }
  try {
    const html = await renderResume(resume, theme);
    reply.type('text/html').send(html);
  } catch (err) {
    req.log.error({ err }, 'render failed');
    reply.code(500).send({ error: err instanceof Error ? err.message : 'render failed' });
  }
});

app
  .listen({ port: PORT, host: HOST })
  .then(() => app.log.info(`render-service on http://${HOST}:${PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
