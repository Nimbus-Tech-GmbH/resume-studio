import Fastify from 'fastify';
import cors from '@fastify/cors';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from './auth.js';
import { env } from './env.js';
import { getLoggerConfig } from './logger.js';

const app = Fastify({ logger: getLoggerConfig() });

const bootInfo = {
  port: env.AUTH_PORT,
  host: env.AUTH_HOST,
  baseURL: env.AUTH_URL,
  trustedOrigins: env.TRUSTED_ORIGINS,
} as const;

app.log.info(bootInfo, 'auth boot');

await app.register(cors, {
  origin: env.TRUSTED_ORIGINS.length > 0 ? env.TRUSTED_ORIGINS : true,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

/**
 * Auth routes. Proxies all `/api/auth/*` requests to Better Auth handler.
 *
 * Security:
 * - Request headers validated by Better Auth
 * - Cookies NEVER logged
 * - Error messages sanitized to prevent info leakage
 * - All user input passed through Better Auth validation
 */
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

      // Log request (no sensitive data)
      request.log.debug(
        {
          url: url.pathname,
          method: request.method,
          origin: request.headers.origin,
        },
        'auth request'
      );

      const response = await auth.handler(req);

      // Log response (no sensitive data)
      request.log.debug(
        {
          url: url.pathname,
          status: response.status,
          location: response.headers.get('location'),
        },
        'auth response'
      );

      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      return reply.send(response.body ? await response.text() : null);
    } catch (error) {
      // Sanitize error message — never expose internals to client
      const isProduction = process.env.NODE_ENV === 'production';
      const clientMessage = isProduction ? 'Authentication failed' : 'Authentication failed';

      request.log.error(
        {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        'auth handler error'
      );

      return reply.code(500).send({ error: clientMessage });
    }
  },
});

/**
 * Health check endpoint.
 */
app.get('/health', async (): Promise<{ ok: boolean }> => {
  return { ok: true };
});

/**
 * Start server and handle graceful shutdown.
 */
await app
  .listen({ port: env.AUTH_PORT, host: env.AUTH_HOST })
  .then(() => {
    app.log.info(`auth-service on http://${env.AUTH_HOST}:${env.AUTH_PORT}`);
  })
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
      }
    );
  });
}
