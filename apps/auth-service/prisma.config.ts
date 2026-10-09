import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, env } from 'prisma/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Prisma configuration for auth-service.
 *
 * Prisma 7 requires datasource.url here (not in schema.prisma).
 * Loads DATABASE_URL from root .env file.
 * For migrations, uses DIRECT_URL if available (direct connection),
 * falls back to DATABASE_URL (pooled or direct).
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
  },
});
