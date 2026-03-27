import { prisma } from "./prisma";
import { deliverToDestination } from "./delivery";
import { RETRY_POLL_INTERVAL_MS } from "./constants";

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
      // Claim retry first to avoid duplicate delivery from overlapping scheduler ticks
      // or multiple app instances.
      const claimed = await prisma.deliveryAttempt.updateMany({
        where: { id: attempt.id, status: "retrying" },
        data: { status: "pending", nextRetryAt: null },
      });

      if (claimed.count === 0) return;

      return deliverToDestination(
        attempt.id,
        attempt.destination.url,
        attempt.destination.headers as Record<string, string>,
        attempt.message.rawPayload as object
      );
    })
  );
}
