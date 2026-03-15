/**
 * pw-target-queue.ts
 *
 * Per-target operation serialization for the browser gateway.
 *
 * WHY: Playwright serializes CDP commands within a single Page object, but the
 * browser gateway is an HTTP server that can receive concurrent requests from
 * multiple agent sessions. Two requests that hit the same browser tab (targetId)
 * at the same time will interleave their Playwright calls — e.g. agent A starts
 * typing a password while agent B clicks submit, causing the form to be submitted
 * with partial data.
 *
 * HOW: We maintain a Map<targetKey, Promise<unknown>> where each entry is the
 * tail of a FIFO queue for that target. Every interactive operation (click, type,
 * fill, press, evaluate, snapshot, navigate) acquires this queue before executing
 * and releases it when done, regardless of success or failure.
 *
 * KEY DESIGN DECISIONS:
 *   - Per-(profile, targetId) granularity: two agents on different profiles or
 *     different tabs can still run in parallel.
 *   - Read-only operations (screenshot, console logs, network) are intentionally
 *     NOT queued — they don't mutate page state so concurrent reads are safe.
 *   - The queue is purely in-memory: it resets on gateway restart. This is
 *     acceptable because the gateway process is single-node.
 *   - Timeout: if a queued operation hangs, the queue still drains because
 *     the underlying Playwright timeout will reject the promise.
 */

/** Maximum time an operation can hold the lock before the queue is considered stuck. */
const QUEUE_TIMEOUT_MS = 120_000; // 2 minutes matches Playwright's long navigate timeout

/** Map from "<cdpUrl>::<targetId>" → tail of the operation queue for that target. */
const queues = new Map<string, Promise<unknown>>();

function targetKey(cdpUrl: string, targetId?: string): string {
  // Normalize the CDP URL to avoid key mismatches from trailing slashes.
  const base = cdpUrl.replace(/\/$/, "");
  // When targetId is absent we key on the profile's CDP URL (single-tab mode).
  return targetId ? `${base}::${targetId}` : `${base}::default`;
}

/**
 * Serialize all Playwright operations for a given browser target.
 *
 * Usage:
 *   return withTargetLock(cdpUrl, targetId, async () => {
 *     await pw.clickViaPlaywright({ cdpUrl, targetId, ref });
 *   });
 *
 * The returned Promise resolves (or rejects) with the result of `fn`.
 * Concurrent calls with the same key are queued and run one at a time.
 */
export async function withTargetLock<T>(
  cdpUrl: string,
  targetId: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const key = targetKey(cdpUrl, targetId);

  // Chain onto the existing tail — or start fresh if no queue yet.
  const current = queues.get(key) ?? Promise.resolve();

  // Each waiter creates its own promise that becomes the new tail.
  let resolve!: () => void;
  // Allocate a "slot" promise that we'll resolve after fn() completes.
  const slot = new Promise<void>((r) => {
    resolve = r;
  });
  queues.set(key, slot);

  // Wait for all predecessors, then run fn(), always resolve the slot.
  await current.catch(() => {
    /* predecessor failed — we still get our turn */
  });

  // Safety timeout: automatically release the lock if fn() hangs beyond
  // the maximum expected Playwright operation time.
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(`withTargetLock: operation on ${key} timed out after ${QUEUE_TIMEOUT_MS}ms`),
      );
    }, QUEUE_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    return result;
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    // Release the queue slot so the next waiter can proceed.
    resolve();
    // Prune the map entry if we're the current tail (no one waiting).
    if (queues.get(key) === slot) {
      queues.delete(key);
    }
  }
}

/** For testing/diagnostics: number of targets currently with active queues. */
export function activeQueueCount(): number {
  return queues.size;
}
