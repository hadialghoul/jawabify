const queues = new Map<string, Promise<unknown>>();

export function enqueueSend<T>(key: string, task: () => Promise<T>): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(task);
  queues.set(
    key,
    run.catch(() => undefined).finally(() => {
      if (queues.get(key) === (run as Promise<unknown>)) queues.delete(key);
    }),
  );
  return run;
}

let counter = 0;

export function uniqueToken(): string {
  counter = (counter + 1) % 100000;
  const rand = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${counter}-${rand}`;
}

export function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80) || 'file';
}

/** Uploads must live under the workspace folder or storage rejects them. */
export function mediaStoragePath(tenantId: string, contactId: string, fileName: string): string {
  return `${tenantId}/${contactId}/${uniqueToken()}-${safeFileName(fileName)}`;
}

const TRANSIENT = /429|500|502|503|504|timeout|network|fetch failed|Failed to fetch/i;

export async function withRetry<T>(task: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await task();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (i === attempts - 1 || !TRANSIENT.test(msg)) throw err;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastError;
}
