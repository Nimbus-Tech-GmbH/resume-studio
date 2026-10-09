/**
 * Centralized environment variable validation.
 * Throws on startup if any required env var is missing.
 */

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  // Auth service
  AUTH_URL: optionalEnv('AUTH_URL', 'http://localhost:5173'),
  AUTH_PORT: parseInt(optionalEnv('AUTH_PORT', '4000'), 10),
  AUTH_HOST: optionalEnv('AUTH_HOST', '127.0.0.1'),
  BETTER_AUTH_SECRET: requiredEnv('BETTER_AUTH_SECRET'),

  // Cognito
  COGNITO_CLIENT_ID: requiredEnv('COGNITO_CLIENT_ID'),
  COGNITO_CLIENT_SECRET: requiredEnv('COGNITO_CLIENT_SECRET'),
  COGNITO_DOMAIN: requiredEnv('COGNITO_DOMAIN'),
  COGNITO_REGION: requiredEnv('COGNITO_REGION'),
  COGNITO_USERPOOL_ID: requiredEnv('COGNITO_USERPOOL_ID'),

  // Database
  DATABASE_URL: requiredEnv('DATABASE_URL'),

  // CORS
  TRUSTED_ORIGINS: (optionalEnv('TRUSTED_ORIGINS', 'http://localhost:5173'))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Keystone GraphQL
  KEYSTONE_GRAPHQL_ENDPOINT: optionalEnv(
    'KEYSTONE_GRAPHQL_ENDPOINT',
    optionalEnv('VITE_GRAPHQL_ENDPOINT', 'http://localhost:3000/api/graphql')
  ),
} as const;

// Validate port range at startup
if (env.AUTH_PORT < 0 || env.AUTH_PORT > 65535) {
  throw new Error(`Invalid AUTH_PORT: ${env.AUTH_PORT}`);
}
