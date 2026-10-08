import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma configuration for auth-service.
 *
 * Prisma 7 requires datasource.url here (not in schema.prisma).
 * For migrations, uses DATABASE_URL or DIRECT_URL if DATABASE_URL is pooled.
 * For runtime, PrismaClient uses adapter with DATABASE_URL.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // For migrations, prefer DIRECT_URL (direct connection).
    // Fall back to DATABASE_URL (pooled) if DIRECT_URL not set.
    url:
      process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
});
