import { betterAuth } from 'better-auth';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { prisma } from './db.js';

/**
 * Better Auth instance. Loaded by the Fastify server in `server.ts` and by
 * the Better Auth CLI for migrations.
 *
 * The Postgres adapter targets the `auth` schema via `search_path` so Better
 * Auth tables never touch the Keystone `public` schema.
 *
 * After a user signs in via Cognito, we sync them to the Keystone CMS user table
 * (with authId = resume-studio user ID) so GraphQL queries can access their resumes.
 */
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const auth = betterAuth({
  appName: 'Resume Studio',
  baseURL: process.env.AUTH_URL ?? 'http://localhost:5173',
  secret: requiredEnv('BETTER_AUTH_SECRET'),
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
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
  callbacks: {
    async signUpUser(user: any) {
      // After Cognito sign-up, sync to Keystone so GraphQL can access user's resumes
      await syncUserToKeystone(user.id, user.email, user.name ?? '');
      return user;
    },
    async signInUser(user: any) {
      // After Cognito sign-in, ensure user exists in Keystone (handles new users)
      await syncUserToKeystone(user.id, user.email, user.name ?? '');
      return user;
    },
  },
});

/**
 * Sync an authenticated user from resume-studio auth DB to Keystone CMS.
 * Creates a User record with authId = resume-studio user ID if not present.
 * This allows GraphQL queries to access resumes owned by the authenticated user.
 */
async function syncUserToKeystone(
  authId: string,
  email: string,
  name: string,
): Promise<void> {
  // Determine Keystone GraphQL endpoint
  let endpoint = process.env.KEYSTONE_GRAPHQL_ENDPOINT;
  if (!endpoint && process.env.VITE_GRAPHQL_ENDPOINT) {
    endpoint = process.env.VITE_GRAPHQL_ENDPOINT;
  }
  if (!endpoint) {
    endpoint = 'http://localhost:3000/api/graphql';
  }

  try {
    // Check if user already exists by authId
    const checkQuery = `
      query {
        users(where: { authId: { equals: "${authId}" } }) {
          id
        }
      }
    `;

    const checkRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: checkQuery }),
    });

    const checkData = (await checkRes.json()) as {
      data?: { users?: Array<{ id: string }> };
    };
    const existingUsers = checkData.data?.users ?? [];

    if (existingUsers.length > 0) {
      // User already in Keystone
      console.debug('[auth] User already in Keystone', { authId, email });
      return;
    }

    // Create user in Keystone
    const nameEscaped = name.replace(/"/g, '\\"');
    const emailEscaped = email.replace(/"/g, '\\"');

    const createQuery = `
      mutation {
        createUser(data: {
          authId: "${authId}"
          email: "${emailEscaped}"
          name: "${nameEscaped}"
        }) {
          id
          email
        }
      }
    `;

    const createRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: createQuery }),
    });

    const createData = (await createRes.json()) as {
      data?: { createUser?: { id: string } };
      errors?: Array<{ message: string }>;
    };

    if (createData.errors?.length) {
      console.error('[auth] Failed to create Keystone user', {
        authId,
        email,
        errors: createData.errors,
      });
      return;
    }

    console.info('[auth] User synced to Keystone', {
      authId,
      email,
      keystoneId: createData.data?.createUser?.id,
    });
  } catch (error) {
    console.error('[auth] Error syncing user to Keystone', { authId, email, error });
  }
}
