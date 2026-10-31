import type { PrismaClient as PrismaClientType } from "@prisma/client";
import fs from "fs";
import path from "path";
import { syncPrismaMutationToSupabase } from "@/server/db/supabase-sync";

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
  prismaV5?: PrismaClientType;
};

function createPrismaClient(): PrismaClientType {
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
    process.env.DATABASE_URL = resolvedDatabaseUrl;
  }

  // Disconnect any stale pre-env PrismaClient instances from earlier HMR cycles
  for (const stale of [
    globalForPrisma.prisma,
    globalForPrisma.prismaV2,
    globalForPrisma.prismaV3,
    globalForPrisma.prismaV4,
  ]) {
    if (stale && typeof stale.$disconnect === "function") {
      stale.$disconnect().catch(() => undefined);
    }
  }
  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaV2 = undefined;
  globalForPrisma.prismaV3 = undefined;
  globalForPrisma.prismaV4 = undefined;

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

  const client = new PrismaClient({
    datasourceUrl: resolvedDatabaseUrl,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  // Register real-time Supabase synchronization middleware for all mutations
  if (typeof (client as any).$use === "function") {
    (client as any).$use(async (params: any, next: (p: any) => Promise<any>) => {
      const result = await next(params);
      if (
        params.action === "create" ||
        params.action === "update" ||
        params.action === "upsert" ||
        params.action === "delete"
      ) {
        await syncPrismaMutationToSupabase(
          client,
          params.model,
          params.action,
          params.args,
          result
        );
      }
      return result;
    });
  }

  return client;
}

export const prisma: PrismaClientType = globalForPrisma.prismaV5 ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaV5 = prisma;
}
