import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Auto-clean DATABASE_URL in case quotes or extra spaces were included in env
const rawUrl = process.env["DATABASE_URL"] ?? "";
let cleanUrl = rawUrl.trim().replace(/^["']|["']$/g, "");

// In serverless environments (Vercel) with high concurrency (e.g. 200 concurrent students),
// ensure connection_limit is safe to prevent exhausting Supabase / PgBouncer pool limits.
if (cleanUrl) {
  if (!cleanUrl.includes("connection_limit=")) {
    const separator = cleanUrl.includes("?") ? "&" : "?";
    cleanUrl = `${cleanUrl}${separator}connection_limit=5&pool_timeout=30`;
  }
  process.env["DATABASE_URL"] = cleanUrl;
}

const prismaOptions: NonNullable<ConstructorParameters<typeof PrismaClient>[0]> = {
  log: process.env["NODE_ENV"] === "development" ? ["error", "warn"] : ["error"],
};

if (cleanUrl) {
  prismaOptions.datasources = { db: { url: cleanUrl } };
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient(prismaOptions);

// Always reuse prisma client instance across warm serverless invocations
globalForPrisma.prisma = prisma;
