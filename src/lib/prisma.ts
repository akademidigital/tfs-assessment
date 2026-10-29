import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Auto-clean DATABASE_URL in case quotes or extra spaces were included in env
const rawUrl = process.env["DATABASE_URL"] ?? "";
const cleanUrl = rawUrl.trim().replace(/^["']|["']$/g, "");

if (cleanUrl) {
  process.env["DATABASE_URL"] = cleanUrl;
}

const prismaOptions: NonNullable<ConstructorParameters<typeof PrismaClient>[0]> = {
  log: process.env["NODE_ENV"] === "development" ? ["error", "warn"] : ["error"],
};

if (cleanUrl) {
  prismaOptions.datasources = { db: { url: cleanUrl } };
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient(prismaOptions);

if (process.env["NODE_ENV"] !== "production") globalForPrisma.prisma = prisma;
