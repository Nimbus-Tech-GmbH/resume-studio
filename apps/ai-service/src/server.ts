import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { normalizeErrorMessage } from './security/sanitize.js';
import { runConnectionTest } from './routes/test.js';
import { runProposalAnalysis } from './routes/proposals.js';

function safePort(fallback: number): number {
  const raw = process.env.AI_PORT;
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 65535) {
    throw new Error(`Invalid AI_PORT: ${raw}`);
  }
  return n;
}

const PORT = safePort(4100);
const HOST = process.env.AI_HOST ?? '127.0.0.1';
const BODY_LIMIT = Number(process.env.AI_BODY_LIMIT_BYTES ?? 256_000);
const TRUSTED_ORIGINS = (process.env.AI_TRUSTED_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function sendJson(
  res: ServerResponse,
  status: number,
  payload: unknown,
  origin: string | null,
): void {
  const body = JSON.stringify(payload);
  if (origin && TRUSTED_ORIGINS.includes(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('access-control-allow-credentials', 'true');
  }
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type,x-resume-studio-ai-key');
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.statusCode = status;
  res.end(body);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    size += buf.length;
    if (size > BODY_LIMIT) {
      throw new Error('Request body too large');
    }
    chunks.push(buf);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

const server = createServer(async (req, res) => {
  const method = req.method ?? 'GET';
  const url = req.url ?? '/';
  const originHeader = req.headers.origin;
  const origin = typeof originHeader === 'string' ? originHeader : null;

  if (method === 'OPTIONS') {
    sendJson(res, 204, {}, origin);
    return;
  }

  if (method === 'GET' && url === '/health') {
    sendJson(res, 200, { ok: true }, origin);
    return;
  }

  const controller = new AbortController();
  req.on('aborted', () => controller.abort());
  req.on('close', () => {
    if (req.aborted) controller.abort();
  });

  try {
    if (method === 'POST' && url === '/api/ai/test') {
      const body = await readJsonBody(req);
      const result = await runConnectionTest(
        body,
        req.headers as Record<string, string | string[] | undefined>,
        controller.signal,
      );

      // The test ran: the outcome lives in the body (`ok`), not in the status
      // code. A failed connection is a valid answer, so it stays 200. 400 is
      // reserved for malformed requests, which throw and land in the catch.
      sendJson(res, 200, result, origin);
      return;
    }

    if (method === 'POST' && url === '/api/ai/proposals') {
      const body = await readJsonBody(req);
      const result = await runProposalAnalysis(
        body,
        req.headers as Record<string, string | string[] | undefined>,
        controller.signal,
      );
      sendJson(res, 200, result, origin);
      return;
    }

    sendJson(res, 404, { error: 'Not found' }, origin);
  } catch (error) {
    const message = normalizeErrorMessage(error);
    const status = message.includes('Request body too large') ? 413 : 400;
    sendJson(
      res,
      status,
      {
        code: 'INVALID_OUTPUT',
        message,
      },
      origin,
    );
  }
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.info(`[ai-service] listening on http://${HOST}:${PORT}`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
