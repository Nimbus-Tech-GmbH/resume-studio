import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { request as httpRequest } from 'node:http';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { isThemeId } from '@resume-studio/themes';
import type { JsonResume } from '@resume-studio/transformer';
import { renderResume } from './render.js';
import { ipAllowlist } from './auth.js';

function safePort(fallback: number): number {
  const raw = process.env.RENDER_PORT;
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 65535) {
    throw new Error(`Invalid RENDER_PORT: ${raw}`);
  }
  return n;
}

const PORT = safePort(5173);
const HOST = process.env.RENDER_HOST ?? '0.0.0.0';
const CORS_ORIGIN = (process.env.RENDER_CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const ALLOWED_IPS = process.env.RENDER_ALLOWED_IPS
  ? process.env.RENDER_ALLOWED_IPS.split(',').map((s) => s.trim()).filter(Boolean)
  : [];

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: CORS_ORIGIN.length > 0 ? CORS_ORIGIN : true,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
});

app.addHook('onRequest', ipAllowlist(ALLOWED_IPS));

const AUTH_TARGET = process.env.AUTH_TARGET;
if (AUTH_TARGET) {
  // Forward only /api/auth/* to the auth-service so the SPA stays single-origin.
  // Plain node http pass-through keeps the self-contained SSR bundle side-effect free.
  const HOP_BY_HOP = new Set([
    'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
    'te', 'trailer', 'transfer-encoding', 'upgrade',
  ]);

  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    async handler(req, reply) {
      reply.hijack();
      const target = new URL(AUTH_TARGET);
      const body = req.body === undefined ? null : JSON.stringify(req.body);

      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (HOP_BY_HOP.has(key.toLowerCase()) || value === undefined) continue;
        headers[key] = Array.isArray(value) ? value.join(', ') : value;
      }
      headers.host = target.host;
      if (body !== null) headers['content-length'] = Buffer.byteLength(body).toString();

      const out = httpRequest(
        {
          hostname: target.hostname,
          port: target.port,
          path: req.url,
          method: req.method,
          headers,
        },
        (res) => {
          const status = res.statusCode ?? 502;
          const resHeaders: Record<string, string> = {};
          for (const [key, value] of Object.entries(res.headers)) {
            if (HOP_BY_HOP.has(key.toLowerCase()) || value === undefined) continue;
            resHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
          }
          reply.raw.writeHead(status, resHeaders);
          res.on('data', (chunk) => reply.raw.write(chunk));
          res.on('end', () => reply.raw.end());
          res.on('error', (err) => {
            req.log.error({ err }, 'auth proxy downstream error');
            reply.raw.destroy(err as Error);
          });
        },
      );
      out.on('error', (err) => {
        req.log.error({ err }, 'auth proxy error');
        if (!reply.raw.headersSent) reply.code(502).send({ error: 'auth-service unreachable' });
      });
      if (body !== null) out.write(body);
      out.end();
    },
  });
  app.log.info(`proxying /api/auth → ${AUTH_TARGET}`);
}

const webDist = resolve(import.meta.dirname, '../web-dist');
if (existsSync(webDist)) {
  await app.register(fastifyStatic, {
    root: webDist,
    prefix: '/',
  });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/') || req.url === '/health') {
      return reply.code(404).send({ error: 'Not found' });
    }
    return reply.sendFile('index.html');
  });
}

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
    reply.code(500).send({ error: 'Render failed' });
  }
});

app
  .listen({ port: PORT, host: HOST })
  .then(() => app.log.info(`render-service on http://${HOST}:${PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });

const shutdownSignals: readonly NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

for (const signal of shutdownSignals) {
  process.on(signal, () => {
    app.log.info({ signal }, 'shutting down');
    app.close().then(
      () => process.exit(0),
      (err) => {
        app.log.error(err, 'shutdown error');
        process.exit(1);
      },
    );
  });
}
