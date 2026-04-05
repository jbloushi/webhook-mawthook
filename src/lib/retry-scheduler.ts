import { prisma } from "./prisma";
import { decrypt } from "./encryption";
import { deliverToDestination } from "./delivery";
import { RETRY_CLAIM_LEASE_MS, RETRY_POLL_INTERVAL_MS } from "./constants";

let schedulerRunning = false;

export function initRetryScheduler(): void {
  if (schedulerRunning) return;
  schedulerRunning = true;

  setInterval(async () => {
    try {
      await processRetries();
    } catch (err) {
      console.error("[RetryScheduler] Error processing retries:", err);
    }
  }, RETRY_POLL_INTERVAL_MS);

  console.log("[RetryScheduler] Started");
}

async function processRetries(): Promise<void> {
  const pendingRetries = await prisma.deliveryAttempt.findMany({
    where: {
      status: "retrying",
      nextRetryAt: { lte: new Date() },
    },
    include: {
      destination: true,
      message: true,
    },
    take: 50,
  });

  if (pendingRetries.length === 0) return;

  await Promise.allSettled(
    pendingRetries.map(async (attempt) => {
      const now = new Date();
      const leaseUntil = new Date(now.getTime() + RETRY_CLAIM_LEASE_MS);

      // Claim retry first to avoid duplicate delivery from overlapping scheduler ticks
      // or multiple app instances. Lease-based claiming also self-recovers if
      // a process crashes before delivery finishes.
      const claimed = await prisma.deliveryAttempt.updateMany({
        where: {
          id: attempt.id,
          status: "retrying",
          nextRetryAt: { lte: now },
        },
        data: { nextRetryAt: leaseUntil },
      });

      if (claimed.count === 0) return;

      return deliverToDestination(
        attempt.id,
        decrypt(attempt.destination.url),
        JSON.parse(decrypt(attempt.destination.headers)) as Record<string, string>,
        attempt.message.rawPayload as object
      );
    })
  );
}
