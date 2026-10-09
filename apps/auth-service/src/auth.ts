import { betterAuth } from 'better-auth';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { prisma } from './db.js';
import { env } from './env.js';

interface KeystoneUser {
  id: string;
  authId: string;
  email: string;
  name: string;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

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
export const auth = betterAuth({
  appName: 'Resume Studio',
  baseURL: env.AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  socialProviders: {
    cognito: {
      clientId: env.COGNITO_CLIENT_ID,
      clientSecret: env.COGNITO_CLIENT_SECRET,
      domain: env.COGNITO_DOMAIN,
      region: env.COGNITO_REGION,
      userPoolId: env.COGNITO_USERPOOL_ID,
    },
  },
  trustedOrigins: env.TRUSTED_ORIGINS,
  callbacks: {
    async signUpUser(user: any): Promise<any> {
      await linkKeystoneUser(user.id, user.email, user.name ?? '');
      return user;
    },
    async signInUser(user: any): Promise<any> {
      await linkKeystoneUser(user.id, user.email, user.name ?? '');
      return user;
    },
  },
});

/**
 * Validate email for safe GraphQL transmission.
 * Block emails containing GraphQL syntax to prevent injection.
 */
function validateEmailFormat(email: string): boolean {
  // Standard email + GraphQL injection prevention
  const emailRegex = /^[^\s"'`{}<>\\]+@[^\s"'`{}<>\\]+\.[^\s"'`{}<>\\]+$/;
  return emailRegex.test(email);
}

/**
 * Link an authenticated user to their Keystone CMS record by updating authId.
 *
 * Flow:
 * 1. Cognito user signs in → auth-service creates auth.user record
 * 2. This callback fires → fetches Keystone user by email
 * 3. If found, update authId = resume-studio user ID
 * 4. GraphQL queries can now authorize against authId
 *
 * Note: Errors logged via console.error (executed during auth.handler call).
 */
async function linkKeystoneUser(
  authId: string,
  email: string,
  name: string
): Promise<void> {
  // Validate inputs
  if (!authId || !email) {
    console.error('[auth] Invalid user data: missing authId or email');
    return;
  }

  if (!validateEmailFormat(email)) {
    console.error('[auth] Invalid email format');
    return;
  }

  try {
    // Query Keystone for existing user — uses GraphQL variables (safe)
    const checkQuery = `
      query GetUser($email: String!) {
        users(where: { email: { equals: $email } }) {
          id
          authId
          email
          name
        }
      }
    `;

    const checkRes = await fetch(env.KEYSTONE_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: checkQuery,
        variables: { email }, // Safe: passed as variable, not interpolated
      }),
    });

    if (!checkRes.ok) {
      console.error('[auth] GraphQL endpoint returned non-2xx status:', checkRes.status);
      return;
    }

    const checkData = (await checkRes.json()) as GraphQLResponse<{
      users: KeystoneUser[];
    }>;

    if (checkData.errors?.length) {
      console.error('[auth] GraphQL error finding user');
      return;
    }

    const keystoneUser = checkData.data?.users?.[0];

    if (!keystoneUser) {
      console.warn('[auth] Keystone user not found by email');
      return;
    }

    if (keystoneUser.authId === authId) {
      // Already linked — no update needed
      return;
    }

    // Update user — uses GraphQL variables (safe)
    const updateMutation = `
      mutation UpdateUserAuthId($id: ID!, $authId: String!) {
        updateUser(
          where: { id: $id }
          data: { authId: $authId }
        ) {
          id
          authId
        }
      }
    `;

    const updateRes = await fetch(env.KEYSTONE_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: updateMutation,
        variables: {
          id: keystoneUser.id,
          authId, // Safe: passed as variable
        },
      }),
    });

    if (!updateRes.ok) {
      console.error('[auth] GraphQL endpoint returned non-2xx status on update:', updateRes.status);
      return;
    }

    const updateData = (await updateRes.json()) as GraphQLResponse<{
      updateUser: { id: string; authId: string };
    }>;

    if (updateData.errors?.length) {
      console.error('[auth] Failed to update Keystone user authId');
      return;
    }

    // Successfully linked
  } catch (error) {
    console.error('[auth] Error linking Keystone user', error instanceof Error ? error.message : String(error));
  }
}
