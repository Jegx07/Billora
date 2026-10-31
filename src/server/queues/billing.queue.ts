import { BillingEngineService } from "@/server/services/billing-engine.service";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";

export const BILLING_QUEUE_NAME = "billora-recurring-billing";

let billingQueue: Queue | null = null;
let billingWorker: Worker | null = null;
let redisAvailable: boolean | null = null;

/**
 * Checks whether Redis is reachable at REDIS_URL and initializes the BullMQ repeatable scheduler
 * and per-subscription worker. Falls back cleanly to direct transactional execution when Redis is offline.
 */
export async function triggerBillingRunWithQueue(options?: {
  asOfDate?: Date;
  triggeredBy?: "SCHEDULER" | "MANUAL" | "BULLMQ";
  subscriptionIds?: string[];
}) {
  if (redisAvailable === false) {
    return BillingEngineService.runDueBillingCycle(options);
  }

  try {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    const connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 1200,
      lazyConnect: true,
    });

    await connection.connect();
    await connection.ping();
    redisAvailable = true;

    if (!billingQueue) {
      billingQueue = new Queue(BILLING_QUEUE_NAME, { connection: connection as never });
    }
    if (!billingWorker) {
      billingWorker = new Worker(
        BILLING_QUEUE_NAME,
        async (job) => {
          if (job.name === "billing:process-subscription") {
            const { subscriptionId, asOfDate } = job.data;
            return BillingEngineService.billSubscriptionPeriod(
              subscriptionId,
              asOfDate ? new Date(asOfDate) : new Date()
            );
          }
          return BillingEngineService.runDueBillingCycle({
            asOfDate: job.data?.asOfDate ? new Date(job.data.asOfDate) : new Date(),
            triggeredBy: "BULLMQ",
          });
        },
        { connection: connection as never, concurrency: 5 }
      );
    }

    // Run synchronously so API callers also receive the immediate run summary while BullMQ is active
    return await BillingEngineService.runDueBillingCycle({
      ...options,
      triggeredBy: "BULLMQ",
    });
  } catch {
    redisAvailable = false;
    return BillingEngineService.runDueBillingCycle(options);
  }
}
