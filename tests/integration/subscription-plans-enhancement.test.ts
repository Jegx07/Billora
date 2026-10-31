import { prisma } from "../../src/server/db/client";
import { AuthSessionContext } from "../../src/server/middlewares/auth";
import { CatalogService } from "../../src/server/services/catalog.service";
import assert from "assert";

async function runTests() {
  console.log("=== STARTING SUBSCRIPTION PLANS ENHANCEMENT TESTS ===");

  // Find real admin user
  const adminUser = await prisma.user.findFirst({
    where: { email: "admin@billora.io" },
  });
  assert(adminUser, "Expected admin user in database");

  const adminSession: AuthSessionContext = {
    userId: adminUser.id,
    email: adminUser.email,
    role: "ADMIN",
    fullName: adminUser.fullName,
    customerId: null,
    employeeId: null,
    sessionId: "mock-session-admin",
    csrfToken: "mock-csrf-token",
  };

  const employeeSession: AuthSessionContext = {
    userId: adminUser.id,
    email: "emp@billora.io",
    role: "EMPLOYEE",
    fullName: "Sales Employee",
    customerId: null,
    employeeId: "emp-101",
    sessionId: "mock-session-emp",
    csrfToken: "mock-csrf-token",
  };

  // 1. Verify Seeded Plans Exist with proper Cadence & Subscriptions
  console.log("\n[Test 1] Verify existing seeded subscription plans in database...");
  const plans = await prisma.subscriptionPlan.findMany({
    include: { _count: { select: { subscriptions: true } }, planProducts: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
  });

  assert(plans.length >= 4, `Expected at least 4 plans, found ${plans.length}`);
  const frequencies = new Set(plans.map((p) => p.billingFrequency));
  assert(frequencies.has("DAILY"), "Expected DAILY billing frequency to exist");
  assert(frequencies.has("WEEKLY"), "Expected WEEKLY billing frequency to exist");
  assert(frequencies.has("MONTHLY"), "Expected MONTHLY billing frequency to exist");
  assert(frequencies.has("YEARLY"), "Expected YEARLY billing frequency to exist");
  console.log(`✓ Verified ${plans.length} plans covering all frequencies: ${Array.from(frequencies).join(", ")}`);

  // 2. Test Creating a New Subscription Plan as ADMIN
  console.log("\n[Test 2] Create new subscription plan with custom parameters and image URL...");
  const newPlan = await CatalogService.createSubscriptionPlan(adminSession, {
    name: "AI Copilot Pro Sprint Plan",
    description: "Weekly high-velocity cloud compute burst with instant provisioning",
    basePrice: 1499.5,
    billingFrequency: "WEEKLY",
    minQuantity: 2,
    defaultTermMonths: 6,
    autoCloseDays: 3,
    allowPause: true,
    allowEarlyCancel: true,
    allowRenewal: true,
    imageUrl: "/uploads/plans/sample-ai-sprint.png",
  });

  assert(newPlan.id, "Plan should have an ID");
  assert(newPlan.planCode.startsWith("PLN-WEE-"), `Expected PLN-WEE- prefix, got ${newPlan.planCode}`);
  assert.strictEqual(newPlan.name, "AI Copilot Pro Sprint Plan");
  assert.strictEqual(newPlan.minQuantity, 2);
  assert.strictEqual(newPlan.defaultTermMonths, 6);
  assert.strictEqual(newPlan.imageUrl, "/uploads/plans/sample-ai-sprint.png");
  console.log(`✓ Created test plan ${newPlan.planCode} (${newPlan.name}) with basePrice: ₹${newPlan.basePrice}`);

  // 3. Test Authorization: EMPLOYEE cannot create plans
  console.log("\n[Test 3] Verify EMPLOYEE role is forbidden from creating subscription plans...");
  let employeeBlocked = false;
  try {
    await CatalogService.createSubscriptionPlan(employeeSession, {
      name: "Unauthorized Plan",
      basePrice: 500,
      billingFrequency: "MONTHLY",
      minQuantity: 1,
    });
  } catch (err: any) {
    if (err.statusCode === 403 || err.code === "FORBIDDEN") {
      employeeBlocked = true;
    }
  }
  assert(employeeBlocked, "EMPLOYEE should be blocked with 403 Forbidden");
  console.log("✓ Non-admin role was properly rejected with 403 Forbidden");

  // 4. Test Updating Subscription Plan
  console.log("\n[Test 4] Update subscription plan parameters (price, term, rules, image)...");
  const updatedPlan = await CatalogService.updateSubscriptionPlan(adminSession, newPlan.id, {
    name: "AI Copilot Pro Sprint Plan (Enhanced)",
    basePrice: 1799.0,
    defaultTermMonths: 12,
    allowPause: false,
    imageUrl: "/uploads/plans/sample-ai-sprint-v2.png",
  });

  assert.strictEqual(updatedPlan.name, "AI Copilot Pro Sprint Plan (Enhanced)");
  assert.strictEqual(updatedPlan.basePrice, 1799);
  assert.strictEqual(updatedPlan.defaultTermMonths, 12);
  assert.strictEqual(updatedPlan.allowPause, false);
  assert.strictEqual(updatedPlan.imageUrl, "/uploads/plans/sample-ai-sprint-v2.png");
  console.log(`✓ Plan ${newPlan.planCode} updated successfully with new basePrice: ₹${updatedPlan.basePrice}`);

  // 5. Test Status Toggle: Active <-> Inactive
  console.log("\n[Test 5] Toggle plan status between ACTIVE and INACTIVE...");
  const deactivated = await CatalogService.updateSubscriptionPlan(adminSession, newPlan.id, {
    status: "INACTIVE",
  });
  assert.strictEqual(deactivated.status, "INACTIVE");

  const reactivated = await CatalogService.updateSubscriptionPlan(adminSession, newPlan.id, {
    status: "ACTIVE",
  });
  assert.strictEqual(reactivated.status, "ACTIVE");
  console.log(`✓ Plan status toggled ACTIVE -> INACTIVE -> ACTIVE successfully`);

  // 6. Test Deletion Business Rule: Block deletion if plan has active subscriptions
  console.log("\n[Test 6] Ensure deletion is strictly blocked when plan has active subscriptions...");
  const planWithSubs = plans.find((p) => (p._count?.subscriptions ?? 0) > 0);
  assert(planWithSubs, "Should have a plan with existing subscriptions");

  let deletionBlocked = false;
  try {
    await CatalogService.deleteSubscriptionPlan(adminSession, planWithSubs.id);
  } catch (err: any) {
    if (err.statusCode === 409 || err.code === "CONFLICT") {
      deletionBlocked = true;
      console.log(`✓ Deletion blocked as expected with 409 CONFLICT: "${err.message}"`);
    }
  }
  assert(deletionBlocked, "Plan with active contracts MUST NOT be deletable (409 Conflict)");

  // 7. Test Deletion of Plan without Subscriptions: Must succeed
  console.log("\n[Test 7] Delete fresh plan with zero subscriptions...");
  const deleteResult = await CatalogService.deleteSubscriptionPlan(adminSession, newPlan.id);
  assert(deleteResult.success, "Deletion of empty test plan should succeed");

  const checkDeleted = await prisma.subscriptionPlan.findUnique({ where: { id: newPlan.id } });
  assert.strictEqual(checkDeleted, null, "Plan should be completely deleted from database");
  console.log(`✓ Empty plan ${newPlan.planCode} deleted successfully`);

  console.log("\n=== ALL SUBSCRIPTION PLANS TESTS PASSED SUCCESSFULLY! ===");
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
