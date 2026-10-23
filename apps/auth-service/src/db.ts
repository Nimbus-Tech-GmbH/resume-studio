import { PrismaClient } from '../prisma/generated/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { env } from './env.js';

/**
 * Prisma Client singleton with PrismaPg driver adapter for PostgreSQL.
 *
 * Uses DATABASE_URL (pooled) for runtime queries.
 * Search path set to `auth` schema to isolate Better Auth from Keystone `public` schema.
 */
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Use search_path to isolate auth schema
  options: '-c search_path=auth',
});

pool.on('error', (err: Error) => {
  // Log to stderr; Fastify will capture via its logger
  console.error('[db] Pool error:', err.message);
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
});
