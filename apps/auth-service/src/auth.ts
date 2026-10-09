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
 * After a user signs in via Cognito, we update their Keystone CMS user record
 * with authId = resume-studio user ID so GraphQL queries can authorize access.
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
      // After Cognito sign-up, link to Keystone user by email
      await linkKeystoneUser(user.id, user.email, user.name ?? '');
      return user;
    },
    async signInUser(user: any) {
      // After Cognito sign-in, ensure Keystone user is linked by authId
      await linkKeystoneUser(user.id, user.email, user.name ?? '');
      return user;
    },
  },
});

/**
 * Link an authenticated user to their Keystone CMS record by updating authId.
 *
 * Expected flow:
 * 1. Cognito user signs in → auth-service creates auth.user record
 * 2. This callback fires → finds Keystone user by email
 * 3. If found, update authId = resume-studio user ID
 * 4. GraphQL queries can now authorize against authId
 */
async function linkKeystoneUser(
  authId: string,
  email: string,
  name: string,
): Promise<void> {
  console.info('[auth] linkKeystoneUser called', { authId, email });
  // Determine Keystone GraphQL endpoint
  let endpoint = process.env.KEYSTONE_GRAPHQL_ENDPOINT;
  if (!endpoint && process.env.VITE_GRAPHQL_ENDPOINT) {
    endpoint = process.env.VITE_GRAPHQL_ENDPOINT;
  }
  if (!endpoint) {
    endpoint = 'http://localhost:3000/api/graphql';
  }

  try {
    // Find Keystone user by email
    const checkQuery = `
      query {
        users(where: { email: { equals: "${email}" } }) {
          id
          authId
          email
          name
        }
      }
    `;

    const checkRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: checkQuery }),
    });

    const checkData = (await checkRes.json()) as {
      data?: { users?: Array<{ id: string; authId: string; email: string; name: string }> };
      errors?: Array<{ message: string }>;
    };

    if (checkData.errors?.length) {
      console.error('[auth] GraphQL error finding user', { email, errors: checkData.errors });
      return;
    }

    const keystoneUser = checkData.data?.users?.[0];

    if (!keystoneUser) {
      console.warn('[auth] Keystone user not found by email', { email });
      return;
    }

    if (keystoneUser.authId === authId) {
      // Already linked correctly
      console.debug('[auth] User already linked', { email, authId });
      return;
    }

    // Update Keystone user with authId
    const updateMutation = `
      mutation {
        updateUser(
          where: { id: "${keystoneUser.id}" }
          data: { authId: "${authId}" }
        ) {
          id
          authId
          email
        }
      }
    `;

    const updateRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: updateMutation }),
    });

    const updateData = (await updateRes.json()) as {
      data?: { updateUser?: { id: string; authId: string } };
      errors?: Array<{ message: string }>;
    };

    if (updateData.errors?.length) {
      console.error('[auth] Failed to update Keystone user', {
        keystoneId: keystoneUser.id,
        email,
        errors: updateData.errors,
      });
      return;
    }

    console.info('[auth] User linked to Keystone', {
      email,
      keystoneId: keystoneUser.id,
      authId,
    });
  } catch (error) {
    console.error('[auth] Error linking Keystone user', { email, authId, error });
  }
}
