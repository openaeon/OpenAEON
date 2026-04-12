export type ToolExecutionPolicy = {
  maxRetries: number;
  baseDelayMs: number;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeWithRecovery<T>(
  fn: () => Promise<T>,
  policy: ToolExecutionPolicy = { maxRetries: 2, baseDelayMs: 600 },
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;
  while (attempt <= policy.maxRetries) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt >= policy.maxRetries) {
        throw err;
      }
      const waitMs = policy.baseDelayMs * 2 ** attempt;
      await delay(waitMs);
      attempt += 1;
    }
  }
  throw lastError;
}
