import { prisma } from "./prisma";
import { DELIVERY_TIMEOUT_MS, MAX_RETRIES, getRetryDelay } from "./constants";
import { initRetryScheduler } from "./retry-scheduler";

export async function fanOutToDestinations(
  messageId: string,
  accountId: string,
  rawPayload: object
): Promise<void> {
  const links = await prisma.accountDestination.findMany({
    where: { accountId, active: true },
    include: { destination: true },
  });

  const activeDestinations = links.filter((l) => l.destination.active);

  if (activeDestinations.length === 0) return;

  // Create delivery attempts for all destinations
  const attempts = await Promise.all(
    activeDestinations.map((link) =>
      prisma.deliveryAttempt.create({
        data: {
          messageId,
          destinationId: link.destinationId,
          status: "pending",
          attemptNumber: 1,
        },
      })
    )
  );

  // Ensure retry scheduler is running
  initRetryScheduler();

  // Fire all deliveries concurrently in background so webhook ingestion
  // is not blocked by downstream latency.
  void Promise.allSettled(
    attempts.map((attempt, idx) =>
      deliverToDestination(
        attempt.id,
        activeDestinations[idx].destination.url,
        activeDestinations[idx].destination.headers as Record<string, string>,
        rawPayload
      )
    )
  );
}

export async function deliverToDestination(
  attemptId: string,
  url: string,
  customHeaders: Record<string, string>,
  payload: object
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...customHeaders,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const responseBody = await res.text().catch(() => "");
    const truncatedBody = responseBody.slice(0, 1000);

    if (res.ok) {
      await prisma.deliveryAttempt.update({
        where: { id: attemptId },
        data: {
          status: "success",
          statusCode: res.status,
          responseBody: truncatedBody,
        },
      });
    } else {
      await handleFailure(attemptId, res.status, truncatedBody, null);
    }
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error";
    await handleFailure(attemptId, null, null, errorMessage);
  } finally {
    clearTimeout(timeout);
  }
}

async function handleFailure(
  attemptId: string,
  statusCode: number | null,
  responseBody: string | null,
  errorMessage: string | null
): Promise<void> {
  const attempt = await prisma.deliveryAttempt.findUnique({
    where: { id: attemptId },
  });

  if (!attempt) return;

  if (attempt.attemptNumber >= MAX_RETRIES) {
    await prisma.deliveryAttempt.update({
      where: { id: attemptId },
      data: {
        status: "failed",
        statusCode,
        responseBody,
        errorMessage,
      },
    });
    return;
  }

  const delay = getRetryDelay(attempt.attemptNumber);
  const nextRetryAt = new Date(Date.now() + delay);

  await prisma.deliveryAttempt.update({
    where: { id: attemptId },
    data: {
      status: "retrying",
      statusCode,
      responseBody,
      errorMessage,
      nextRetryAt,
      attemptNumber: attempt.attemptNumber + 1,
    },
  });
}
