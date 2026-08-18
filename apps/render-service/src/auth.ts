import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Allowlist middleware. Rejects requests whose remote address is not in the
 * provided set. Set is small enough that a `Set<string>` lookup is fine.
 * Do not expose the render service publicly until Cognito auth is wired.
 */
export function ipAllowlist(allowed: readonly string[]) {
  const set = new Set(allowed);
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const ip = req.ip;
    if (!set.has(ip)) {
      req.log.warn({ ip }, 'blocked by IP allowlist');
      await reply.code(403).send({ error: 'Forbidden' });
    }
  };
}
