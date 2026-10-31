import type { PrismaClient as PrismaClientType } from "@prisma/client";
import fs from "fs";
import os from "os";
import path from "path";
import { invalidateServerCacheForModel } from "@/server/cache/query-cache";
import { syncPrismaMutationToSupabase } from "@/server/db/supabase-sync";

const DEFAULT_SQLITE_URL = "file:./dev.db";

const IS_SERVERLESS_RUNTIME = Boolean(
  process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT
);

function isDirectoryWritable(dirPath: string): boolean {
  try {
    if (!fs.existsSync(dirPath)) return false;
    fs.accessSync(dirPath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function findBundledSqliteFile(rawPath: string): string | null {
  const baseName = path.basename(rawPath) || "dev.db";
  const candidates = [
    path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath),
    path.resolve(process.cwd(), "prisma", baseName),
    path.resolve(process.cwd(), "prisma", "dev.db"),
    path.resolve(process.cwd(), baseName),
    path.resolve(process.cwd(), ".next", "server", "prisma", baseName),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // Ignore inaccessible candidate paths
    }
  }
  return null;
}

function resolveDatabaseUrl(rawUrl?: string): { url: string; isServerlessTmp: boolean } {
  const url = rawUrl && rawUrl.trim() ? rawUrl.trim() : DEFAULT_SQLITE_URL;
  if (!url.startsWith("file:")) {
    return { url, isServerlessTmp: false };
  }

  const rawPath = url.slice("file:".length).split("?")[0];
  const bundledFile = findBundledSqliteFile(rawPath);
  const defaultLocalTarget = path.isAbsolute(rawPath)
    ? rawPath
    : bundledFile || path.resolve(process.cwd(), "prisma", rawPath);
  const targetDir = path.dirname(defaultLocalTarget);

  // On Vercel / AWS Lambda or whenever the deployment directory is read-only,
  // SQLite throws "Error code 14: Unable to open the database file" unless placed in os.tmpdir() (/tmp).
  if (IS_SERVERLESS_RUNTIME || !isDirectoryWritable(targetDir)) {
    const tmpDbPath = path.join(os.tmpdir(), "billora.db");
    try {
      const tmpExists = fs.existsSync(tmpDbPath);
      const tmpSize = tmpExists ? fs.statSync(tmpDbPath).size : 0;
      const sourceSize = bundledFile && fs.existsSync(bundledFile) ? fs.statSync(bundledFile).size : 0;

      // Copy the bundled seed database into /tmp/billora.db on cold start
      if (bundledFile && (!tmpExists || (tmpSize < 4096 && sourceSize > tmpSize))) {
        fs.copyFileSync(bundledFile, tmpDbPath);
        try {
          fs.chmodSync(tmpDbPath, 0o666);
        } catch {
          // Ignore chmod errors on platforms that do not support POSIX modes
        }
      }
    } catch {
      // If copy fails, SQLite will still initialize /tmp/billora.db if possible
    }
    return {
      url: `file:${tmpDbPath.replace(/\\/g, "/")}`,
      isServerlessTmp: true,
    };
  }

  return {
    url: `file:${defaultLocalTarget}`,
    isServerlessTmp: false,
  };
}

const resolvedDb = resolveDatabaseUrl(process.env.DATABASE_URL);
const resolvedDatabaseUrl = resolvedDb.url;
process.env.DATABASE_URL = resolvedDatabaseUrl;

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
    if (resolvedDb.isServerlessTmp) {
      // On serverless /tmp, MEMORY journal avoids .db-shm mmap failures while remaining fast
      await client.$queryRawUnsafe("PRAGMA journal_mode = MEMORY;");
    } else {
      await client.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
    }
    await client.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");
    await client.$queryRawUnsafe("PRAGMA temp_store = MEMORY;");
    await client.$queryRawUnsafe("PRAGMA cache_size = -64000;");
    await client.$queryRawUnsafe("PRAGMA busy_timeout = 5000;");
  } catch {
    // Ignore if database is not SQLite
  }
}

function createPrismaClient(): PrismaClientType {
  process.env.DATABASE_URL = resolvedDatabaseUrl;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require("@prisma/client") as {
    PrismaClient: new (options?: Record<string, unknown>) => PrismaClientType;
  };

  const baseClient = new PrismaClient({
    datasourceUrl: resolvedDatabaseUrl,
    log: process.env.NODE_ENV === "development" ? ["error"] : ["error"],
  });

  // Use Prisma v6 Client Extensions for cache invalidation & Supabase replication
  if (typeof (baseClient as any).$extends === "function") {
    const extendedClient = (baseClient as any).$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }: any) {
            const result = await query(args);
            if (WRITE_ACTIONS.has(operation)) {
              invalidateServerCacheForModel(model);
              if (IS_SERVERLESS_RUNTIME) {
                // On Vercel serverless, await replication (bounded to 2.5s) before Lambda freezes
                await Promise.race([
                  syncPrismaMutationToSupabase(baseClient, model, operation, args, result),
                  new Promise((resolve) => setTimeout(resolve, 2500)),
                ]).catch(() => undefined);
              } else {
                // Non-blocking background replication in local dev
                const timer = setTimeout(() => {
                  void syncPrismaMutationToSupabase(baseClient, model, operation, args, result);
                }, 0);
                if (typeof timer.unref === "function") timer.unref();
              }
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
globalForPrisma.prismaV6 = prisma;
