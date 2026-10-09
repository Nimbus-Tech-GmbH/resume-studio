/**
 * Migrate existing Keystone users to the auth-service Prisma DB.
 *
 * For each Keystone user WITHOUT an authId:
 * 1. Create a matching user in the auth-service DB
 * 2. Update the Keystone user's authId to point to the new auth-service user ID
 *
 * This bridges the two databases so existing Keystone users can sign in via Cognito.
 *
 * Usage:
 *   pnpm migrate:keystone-users
 *
 * Requires env vars:
 *   - DATABASE_URL (auth-service DB in Prisma.io)
 *   - KEYSTONE_GRAPHQL_ENDPOINT or VITE_GRAPHQL_ENDPOINT (Keystone GraphQL)
 */

import { PrismaClient } from '../prisma/generated/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { config } from 'dotenv';

// Load .env from root
config({ path: new URL('../../.env', import.meta.url).pathname });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL env var is required');
}

// Set search_path for auth schema (same as server.ts)
const pool = new pg.Pool({
  connectionString: DATABASE_URL,
});

pool.on('connect', (client) => {
  client.query('SET search_path = auth, public;');
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('[migrate] Starting Keystone → auth-service user migration...\n');

  // Get Keystone endpoint
  let keystoneEndpoint = process.env.KEYSTONE_GRAPHQL_ENDPOINT;
  if (!keystoneEndpoint && process.env.VITE_GRAPHQL_ENDPOINT) {
    keystoneEndpoint = process.env.VITE_GRAPHQL_ENDPOINT;
  }
  if (!keystoneEndpoint) {
    keystoneEndpoint = 'http://localhost:3000/api/graphql';
  }

  console.log(`[migrate] Keystone endpoint: ${keystoneEndpoint}`);
  console.log(`[migrate] Auth-service DB: ${DATABASE_URL?.split('@')[1] || 'unknown'}\n`);

  // Fetch all Keystone users
  const query = `
    query {
      users {
        id
        authId
        name
        email
      }
    }
  `;

  interface KeystoneUser {
    id: string;
    authId: string;
    name: string;
    email: string;
  }

  let keystoneUsers: KeystoneUser[] = [];

  try {
    const res = await fetch(keystoneEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    const data = (await res.json()) as {
      data?: { users?: KeystoneUser[] };
      errors?: Array<{ message: string }>;
    };

    if (data.errors?.length) {
      console.error('[migrate] GraphQL errors:', data.errors);
      return;
    }

    keystoneUsers = data.data?.users ?? [];
    console.log(`[migrate] Found ${keystoneUsers.length} Keystone users\n`);
  } catch (error) {
    console.error('[migrate] Failed to fetch Keystone users:', error);
    return;
  }

  if (keystoneUsers.length === 0) {
    console.log('[migrate] No users to migrate.');
    return;
  }

  // Process each Keystone user
  let created = 0;
  let linked = 0;
  let skipped = 0;

  for (const keystoneUser of keystoneUsers) {
    if (keystoneUser.authId) {
      console.log(
        `[migrate] SKIP ${keystoneUser.email} (already linked to authId: ${keystoneUser.authId})`,
      );
      skipped++;
      continue;
    }

    try {
      // Create user in auth-service DB
      const authUser = await prisma.user.create({
        data: {
          name: keystoneUser.name || keystoneUser.email,
          email: keystoneUser.email,
          emailVerified: false,
        },
      });

      console.log(
        `[migrate] CREATE ${keystoneUser.email} → auth-service user ${authUser.id}`,
      );

      // Update Keystone user with authId
      const updateMutation = `
        mutation {
          updateUser(
            where: { id: "${keystoneUser.id}" }
            data: { authId: "${authUser.id}" }
          ) {
            id
            authId
          }
        }
      `;

      const updateRes = await fetch(keystoneEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: updateMutation }),
      });

      const updateData = (await updateRes.json()) as {
        data?: { updateUser?: { id: string; authId: string } };
        errors?: Array<{ message: string }>;
      };

      if (updateData.errors?.length) {
        console.error(
          `[migrate]   ERROR updating Keystone user ${keystoneUser.id}:`,
          updateData.errors,
        );
        // Note: auth-service user was created but Keystone not updated — inconsistent state
        continue;
      }

      console.log(
        `[migrate]   LINKED Keystone user ${keystoneUser.id} → authId ${authUser.id}\n`,
      );
      created++;
      linked++;
    } catch (error) {
      console.error(`[migrate] ERROR processing ${keystoneUser.email}:`, error);
    }
  }

  console.log(
    `\n[migrate] Complete: ${created} auth-service users created, ${linked} Keystone users linked, ${skipped} already linked`,
  );
  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
