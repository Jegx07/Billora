import type { PrismaClient as PrismaClientType } from "@prisma/client";

const DEFAULT_SQLITE_URL = "file:./dev.db";

if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
  process.env.DATABASE_URL = DEFAULT_SQLITE_URL;
}

const resolvedDatabaseUrl = process.env.DATABASE_URL || DEFAULT_SQLITE_URL;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientType;
  prismaV2?: PrismaClientType;
  prismaV3?: PrismaClientType;
  prismaV4?: PrismaClientType;
};

function createPrismaClient(): PrismaClientType {
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
    process.env.DATABASE_URL = resolvedDatabaseUrl;
  }

  // Disconnect any stale pre-env PrismaClient instances from earlier HMR cycles
  for (const stale of [globalForPrisma.prisma, globalForPrisma.prismaV2, globalForPrisma.prismaV3]) {
    if (stale && typeof stale.$disconnect === "function") {
      stale.$disconnect().catch(() => undefined);
    }
  }
  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaV2 = undefined;
  globalForPrisma.prismaV3 = undefined;

  // Evict cached JS wrapper modules so the updated .prisma/client config is loaded
  try {
    for (const key of Object.keys(require.cache)) {
      if (
        (key.includes(".prisma") || key.includes("@prisma")) &&
        key.endsWith(".js")
      ) {
        delete require.cache[key];
      }
    }
  } catch {
    // ignore if require.cache is unavailable
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require("@prisma/client") as {
    PrismaClient: new (options?: Record<string, unknown>) => PrismaClientType;
  };

  return new PrismaClient({
    datasourceUrl: resolvedDatabaseUrl,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma: PrismaClientType = globalForPrisma.prismaV4 ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaV4 = prisma;
}
