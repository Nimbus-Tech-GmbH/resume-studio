import Fastify from 'fastify';
import cors from '@fastify/cors';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from './auth.js';

function safePort(fallback: number): number {
  const raw = process.env.AUTH_PORT;
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 65535) {
    throw new Error(`Invalid AUTH_PORT: ${raw}`);
  }
  return n;
}

const PORT = safePort(4000);
const HOST = process.env.AUTH_HOST ?? '127.0.0.1';
const CORS_ORIGIN = (process.env.TRUSTED_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: CORS_ORIGIN.length > 0 ? CORS_ORIGIN : true,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

app.route({
  method: ['GET', 'POST'],
  url: '/api/auth/*',
  async handler(request, reply) {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const headers = fromNodeHeaders(request.headers);

      let body: RequestInit['body'];
      if (request.method === 'POST') {
        const raw = JSON.stringify(request.body ?? {});
        body = raw === '{}' ? undefined : raw;
      }

      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        ...(body ? { body } : {}),
      });

      const response = await auth.handler(req);

      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      return reply.send(response.body ? await response.text() : null);
    } catch (err) {
      request.log.error({ err }, 'better-auth handler failed');
      return reply.code(500).send({ error: 'Internal authentication error' });
    }
  },
});

app.get('/health', async () => ({ ok: true }));

app
  .listen({ port: PORT, host: HOST })
  .then(() => app.log.info(`auth-service on http://${HOST}:${PORT}`))
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