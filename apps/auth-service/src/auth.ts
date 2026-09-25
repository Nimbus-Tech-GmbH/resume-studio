import { betterAuth } from 'better-auth';
import { Pool } from 'pg';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const databaseUrl = requiredEnv('DATABASE_URL');

/**
 * Better Auth instance. Loaded by the Fastify server in `server.ts` and by
 * the Better Auth CLI for migrations.
 *
 * The Postgres adapter targets the `auth` schema via `search_path` so Better
 * Auth tables never touch the Keystone `public` schema.
 */
export const auth = betterAuth({
  appName: 'Resume Studio',
  baseURL: process.env.AUTH_URL ?? 'http://localhost:5173',
  secret: requiredEnv('BETTER_AUTH_SECRET'),
  database: new Pool({
    connectionString: databaseUrl,
    options: '-c search_path=auth',
  }),
  socialProviders: {
    cognito: {
      clientId: requiredEnv('COGNITO_CLIENT_ID'),
      clientSecret: requiredEnv('COGNITO_CLIENT_SECRET'),
      domain: requiredEnv('COGNITO_DOMAIN'),
      region: requiredEnv('COGNITO_REGION'),
      userPoolId: requiredEnv('COGNITO_USERPOOL_ID'),
    },
  },
  trustedOrigins: (process.env.TRUSTED_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
});