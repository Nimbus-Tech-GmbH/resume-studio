import { PrismaClient } from '../prisma/generated/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

/**
 * Prisma Client singleton with PrismaPg driver adapter for PostgreSQL.
 *
 * Uses DATABASE_URL (pooled) for runtime queries.
 * Search path set to `auth` schema to isolate Better Auth from Keystone `public` schema.
 */
const pool = new Pool({
  connectionString: requiredEnv('DATABASE_URL'),
  options: '-c search_path=auth',
});

pool.on('error', (err) => {
  console.error('[db] Pool error:', err.message);
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
});

// Test connection on startup
try {
  await prisma.$queryRaw`SELECT 1`;
  console.log('[db] Connection test passed');
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('[db] Connection test failed:', msg);
  throw err;
}
