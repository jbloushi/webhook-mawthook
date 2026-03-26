export const MAX_RETRIES = 5;
export const RETRY_BASE_DELAY_MS = 1000;
export const RETRY_MULTIPLIER = 4;
export const DELIVERY_TIMEOUT_MS = 10000;
export const RETRY_POLL_INTERVAL_MS = 5000;

export function getRetryDelay(attemptNumber: number): number {
  return Math.pow(RETRY_MULTIPLIER, attemptNumber - 1) * RETRY_BASE_DELAY_MS;
}
