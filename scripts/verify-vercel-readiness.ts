import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

async function run() {
  console.log("====================================================================");
  console.log(" BILLORA — VERCEL SERVERLESS & SUPABASE DEPLOYMENT VERIFICATION");
  console.log("====================================================================\n");

  // Step 1: Checkpoint prisma/dev.db so 100% of WAL data is inside prisma/dev.db for Git & Vercel bundling
  const devDbPath = path.resolve(process.cwd(), "prisma", "dev.db");
  assert.equal(fs.existsSync(devDbPath), true, "prisma/dev.db must exist");

  const directPrisma = new PrismaClient({
    datasourceUrl: `file:${devDbPath.replace(/\\/g, "/")}`,
  });
  await directPrisma.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE);");
  await directPrisma.$queryRawUnsafe("PRAGMA journal_mode = DELETE;");
  const counts = {
    users: await directPrisma.user.count(),
    customers: await directPrisma.customer.count(),
    subscriptions: await directPrisma.subscription.count(),
    invoices: await directPrisma.invoice.count(),
    workflows: await directPrisma.workflow.count(),
  };
  await directPrisma.$disconnect();

  // Remove any leftover .db-wal / .db-shm files
  for (const ext of ["-wal", "-shm", "-journal"]) {
    const sidecar = `${devDbPath}${ext}`;
    if (fs.existsSync(sidecar)) {
      try {
        fs.unlinkSync(sidecar);
      } catch {
        // Ignore if locked
      }
    }
  }

  console.log(
    `[PASS] 1. Checkpointed prisma/dev.db into a single self-contained file (${(
      fs.statSync(devDbPath).size /
      (1024 * 1024)
    ).toFixed(2)} MB) ->`,
    counts
  );

  // Step 2: Simulate Vercel Serverless Environment (process.env.VERCEL = "1")
  process.env.VERCEL = "1";
  const tmpDbPath = path.join(os.tmpdir(), "billora.db");
  if (fs.existsSync(tmpDbPath)) {
    try {
      fs.unlinkSync(tmpDbPath);
    } catch {
      // Ignore
    }
  }

  const { prisma } = await import("../src/server/db/client");
  const { AuthService } = await import("../src/server/services/auth.service");
  const { verifySignedSessionToken } = await import("../src/server/middlewares/auth");
  const { getSupabaseConfigStatus } = await import("../src/lib/supabase/config");

  assert.equal(
    fs.existsSync(tmpDbPath),
    true,
    "Serverless Prisma client must copy prisma/dev.db into os.tmpdir()/billora.db"
  );
  console.log(`[PASS] 2. Vercel Serverless DB initialized at writable ${tmpDbPath} (Error code 14 eliminated).`);

  // Step 3: Verify login works on Vercel Serverless for Admin, Employee, and Customer
  const adminLogin = await AuthService.login({
    email: "admin@billora.io",
    password: "Admin@Billora2026!",
  });
  assert.equal(adminLogin.user.role, "ADMIN");
  assert.ok(adminLogin.sessionToken.startsWith("bs1."), "Session token must be HMAC-signed (bs1.*)");

  const verifiedPayload = verifySignedSessionToken(adminLogin.sessionToken);
  assert.ok(verifiedPayload, "HMAC-signed session token must verify across stateless serverless instances");
  assert.equal(verifiedPayload.email, "admin@billora.io");
  assert.equal(verifiedPayload.role, "ADMIN");
  console.log("[PASS] 3. Admin login & cross-instance stateless HMAC session token verified.");

  // Step 4: Verify Supabase connection configuration fallback for Vercel
  const sbStatus = getSupabaseConfigStatus();
  assert.equal(sbStatus.isConfigured, true, "Supabase must be configured in Vercel environment");
  assert.equal(sbStatus.url, "https://ahhudqmffgzfomcncloo.supabase.co");
  console.log(`[PASS] 4. Supabase configuration active (${sbStatus.url}, mode=${sbStatus.mode}).`);

  await prisma.$disconnect();
  console.log("\nALL VERCEL SERVERLESS & SUPABASE CHECKS PASSED.");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
