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
import { env } from './env.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: env.RENDER_CORS_ORIGIN.length > 0 ? env.RENDER_CORS_ORIGIN : true,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
});

app.addHook('onRequest', ipAllowlist(env.RENDER_ALLOWED_IPS));

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function mountProxy(
  prefix: '/api/auth',
  targetEnv: string | undefined,
  errorLabel: string,
): void {
  if (!targetEnv) {
    app.log.warn(`${prefix} target is unset — ${prefix}/* will NOT be proxied.`);
    return;
  }

  const parsedTarget = new URL(targetEnv);
  const remote = `${parsedTarget.protocol}//${parsedTarget.host}`;

  app.route({
    method: ['GET', 'POST'],
    url: `${prefix}/*`,
    async handler(req, reply) {
      req.log.debug(
        { method: req.method, url: req.url, target: remote },
        `${prefix} proxy request`,
      );
      reply.hijack();
      const body = req.body === undefined ? null : JSON.stringify(req.body);

      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (HOP_BY_HOP.has(key.toLowerCase()) || value === undefined) continue;
        headers[key] = Array.isArray(value) ? value.join(', ') : value;
      }
      headers.host = parsedTarget.host;
      if (body !== null) headers['content-length'] = Buffer.byteLength(body).toString();

      let upstreamClosed = false;
      const out = httpRequest(
        {
          hostname: parsedTarget.hostname,
          port: parsedTarget.port,
          path: req.url,
          method: req.method,
          headers,
        },
        (res) => {
          const status = res.statusCode ?? 502;
          const resHeaders: Record<string, string | string[]> = {};
          for (const [key, value] of Object.entries(res.headers)) {
            if (HOP_BY_HOP.has(key.toLowerCase()) || value === undefined) continue;
            // Set-Cookie headers must remain as array; other headers can be joined
            if (key.toLowerCase() === 'set-cookie' && Array.isArray(value)) {
              resHeaders[key] = value;
            } else {
              resHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
            }
          }
          // Preserve upstream content-type.
          req.log.debug({ status }, `${prefix} proxy response`);
          if (reply.raw.headersSent || reply.raw.writableEnded) {
            res.destroy();
            return;
          }
          reply.raw.writeHead(status, resHeaders);

          const onDrain = () => {
            res.resume();
          };

          res.on('data', (chunk) => {
            if (reply.raw.writableEnded || reply.raw.destroyed) {
              res.destroy();
              return;
            }
            const ok = reply.raw.write(chunk);
            if (!ok) {
              res.pause();
              reply.raw.once('drain', onDrain);
            }
          });
          res.on('end', () => {
            if (!reply.raw.writableEnded) reply.raw.end();
          });
          res.on('error', (err) => {
            req.log.error({ message: err.message }, `${prefix} proxy downstream error`);
            if (!reply.raw.destroyed) reply.raw.destroy();
          });
        },
      );

      const abortUpstream = () => {
        if (upstreamClosed) return;
        upstreamClosed = true;
        out.destroy();
      };

      req.raw.on('aborted', abortUpstream);
      reply.raw.on('close', () => {
        if (!reply.raw.writableEnded) abortUpstream();
      });

      out.on('error', (err) => {
        req.log.error({ message: err.message }, `${prefix} proxy error`);
        if (!reply.raw.headersSent && !reply.raw.writableEnded) {
          reply.raw.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
          reply.raw.end(JSON.stringify({ error: errorLabel }));
          return;
        }
        if (!reply.raw.destroyed) reply.raw.destroy();
      });
      if (body !== null) out.write(body);
      out.end();
    },
  });

  app.log.info(`proxying ${prefix} → ${targetEnv}`);
}

mountProxy('/api/auth', env.AUTH_TARGET, 'auth-service unreachable');

/**
 * OpenCode inference does not send CORS headers, so the browser cannot call it
 * directly. Proxy the OpenAI-compatible family through the app origin. The
 * upstream API key is forwarded from the browser and never logged.
 */
const opencodeTarget = new URL(env.OPENCODE_TARGET);
app.route({
  method: ['GET', 'POST'],
  url: '/api/ai/opencode/*',
  bodyLimit: 5 * 1024 * 1024,
  async handler(req, reply) {
    const path = req.url.replace(/^\/api\/ai\/opencode/, '/inference');
    const headers: Record<string, string> = { accept: 'application/json' };
    if (typeof req.headers.authorization === 'string') {
      headers.authorization = req.headers.authorization;
    }
    if (typeof req.headers['content-type'] === 'string') {
      headers['content-type'] = req.headers['content-type'];
    }
    const body =
      req.method === 'GET' || req.body === undefined
        ? undefined
        : JSON.stringify(req.body);
    const url = new URL(path, opencodeTarget);
    try {
      const upstream = await fetch(url, {
        method: req.method,
        headers,
        body,
        signal: AbortSignal.timeout(120_000),
      });
      const contentType = upstream.headers.get('content-type');
      if (contentType) reply.header('content-type', contentType);
      req.log.debug({ status: upstream.status }, 'opencode inference proxy response');
      return reply
        .status(upstream.status)
        .send(Buffer.from(await upstream.arrayBuffer()));
    } catch (error) {
      req.log.error(
        { message: error instanceof Error ? error.message : String(error) },
        'opencode inference proxy error',
      );
      return reply.code(502).send({ error: 'OpenCode inference unreachable' });
    }
  },
});
app.log.info(`proxying /api/ai/opencode → ${opencodeTarget.origin}/inference`);

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

app.get('/health', async (): Promise<{ ok: boolean }> => {
  return { ok: true };
});

interface RenderBody {
  resume: JsonResume;
  theme: string;
}

app.post<{ Body: RenderBody }>('/render', async (req, reply) => {
  const { resume, theme } = req.body ?? ({} as RenderBody);
  if (!resume || typeof resume !== 'object') {
    return reply.code(400).send({ error: 'Invalid request' });
  }
  if (!isThemeId(theme)) {
    return reply.code(400).send({ error: 'Invalid request' });
  }
  try {
    const html = await renderResume(resume, theme);
    reply.type('text/html').send(html);
  } catch (err) {
    req.log.error(
      { message: err instanceof Error ? err.message : String(err) },
      'render failed',
    );
    reply.code(500).send({ error: 'Server error' });
  }
});

await app
  .listen({ port: env.RENDER_PORT, host: env.RENDER_HOST })
  .then(() => app.log.info(`render-service on http://${env.RENDER_HOST}:${env.RENDER_PORT}`))
  .catch((err: Error) => {
    app.log.error(err);
    process.exit(1);
  });

const shutdownSignals: readonly NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

for (const signal of shutdownSignals) {
  process.on(signal, () => {
    app.log.info({ signal }, 'shutting down');
    app.close().then(
      () => process.exit(0),
      (err: Error) => {
        app.log.error(err, 'shutdown error');
        process.exit(1);
      },
    );
  });
}
