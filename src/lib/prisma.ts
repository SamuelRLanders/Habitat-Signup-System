import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Reuse one client across hot reloads in development so we don't exhaust
// database connections.
// Typed loosely: after a regenerate, the cached client is an older class.
const globalForPrisma = globalThis as unknown as {
  prisma?: { $disconnect(): Promise<void> };
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// After `prisma generate` (for example, following a migration), the reloaded
// PrismaClient is a new class, so the cached client is from the old schema.
// Replace it rather than keep querying with outdated models.
const cached = globalForPrisma.prisma;
if (cached && !(cached instanceof PrismaClient)) void cached.$disconnect();

export const prisma =
  cached instanceof PrismaClient ? cached : createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
