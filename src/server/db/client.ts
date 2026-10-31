import type { PrismaClient as PrismaClientType } from "@prisma/client";
import fs from "fs";
import path from "path";

const DEFAULT_SQLITE_URL = "file:./dev.db";

function resolveDatabaseUrl(rawUrl?: string): string {
  const url = rawUrl && rawUrl.trim() ? rawUrl.trim() : DEFAULT_SQLITE_URL;
  if (url.startsWith("file:")) {
    const rawPath = url.slice("file:".length);
    if (!path.isAbsolute(rawPath)) {
      const inCwd = path.resolve(process.cwd(), rawPath);
      const inPrisma = path.resolve(process.cwd(), "prisma", rawPath);
      if (fs.existsSync(inCwd)) {
        return `file:${inCwd}`;
      }
      if (fs.existsSync(inPrisma)) {
        return `file:${inPrisma}`;
      }
      return `file:${inPrisma}`;
    }
  }
  return url;
}

if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
  process.env.DATABASE_URL = DEFAULT_SQLITE_URL;
}

const resolvedDatabaseUrl = resolveDatabaseUrl(process.env.DATABASE_URL);

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
