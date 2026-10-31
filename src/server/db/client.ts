import type { PrismaClient as PrismaClientType } from "@prisma/client";
import fs from "fs";
import path from "path";
import { invalidateServerCacheForModel } from "@/server/cache/query-cache";
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
  prismaV6?: PrismaClientType;
  sqlitePragmasApplied?: boolean;
};

const WRITE_ACTIONS = new Set([
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
]);

async function applySqlitePerformancePragmas(client: PrismaClientType) {
  if (globalForPrisma.sqlitePragmasApplied || !resolvedDatabaseUrl.startsWith("file:")) {
    return;
  }
  globalForPrisma.sqlitePragmasApplied = true;
  try {
    await client.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
    await client.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");
    await client.$queryRawUnsafe("PRAGMA temp_store = MEMORY;");
    await client.$queryRawUnsafe("PRAGMA cache_size = -64000;");
    await client.$queryRawUnsafe("PRAGMA busy_timeout = 5000;");
  } catch {
    // Ignore if database is not SQLite
  }
}

function createPrismaClient(): PrismaClientType {
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
    process.env.DATABASE_URL = resolvedDatabaseUrl;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require("@prisma/client") as {
    PrismaClient: new (options?: Record<string, unknown>) => PrismaClientType;
  };

  const baseClient = new PrismaClient({
    datasourceUrl: resolvedDatabaseUrl,
    log: process.env.NODE_ENV === "development" ? ["error"] : ["error"],
  });

  // Use Prisma v6 Client Extensions for zero-overhead cache invalidation & non-blocking Supabase sync
  if (typeof (baseClient as any).$extends === "function") {
    const extendedClient = (baseClient as any).$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }: any) {
            const result = await query(args);
            if (WRITE_ACTIONS.has(operation)) {
              invalidateServerCacheForModel(model);
              // Non-blocking background replication to Supabase (never delays local HTTP response)
              const timer = setTimeout(() => {
                void syncPrismaMutationToSupabase(baseClient, model, operation, args, result);
              }, 0);
              if (typeof timer.unref === "function") timer.unref();
            }
            return result;
          },
        },
      },
    }) as PrismaClientType;

    void applySqlitePerformancePragmas(extendedClient);
    return extendedClient;
  }

  void applySqlitePerformancePragmas(baseClient);
  return baseClient;
}

export const prisma: PrismaClientType = globalForPrisma.prismaV6 ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaV6 = prisma;
}
