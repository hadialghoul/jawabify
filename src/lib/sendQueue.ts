/**
 * Serialises outbound chat sends per conversation.
 *
 * Sending an image, a text and a file in quick succession used to fire three
 * parallel requests: uploads could collide on identical storage paths, the
 * messaging API could rate-limit or re-order them, and optimistic ids created
 * in the same millisecond overwrote each other. Everything queued through here
 * runs one-at-a-time, in the order the user pressed send.
 */
const queues = new Map<string, Promise<unknown>>();

export function enqueueSend<T>(key: string, task: () => Promise<T>): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve();
  // Never let a failed send break the chain for subsequent messages.
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

/** Collision-proof id/path suffix even when called repeatedly in the same ms. */
export function uniqueToken(): string {
  counter = (counter + 1) % 100000;
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${counter}-${rand}`;
}

export function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80) || 'file';
}

/** Unique storage object path for a chat attachment. */
export function mediaStoragePath(contactId: string, fileName: string): string {
  return `${contactId}/${uniqueToken()}-${safeFileName(fileName)}`;
}

const TRANSIENT = /429|500|502|503|504|timeout|network|fetch failed|Failed to fetch/i;

/** Retries a send a couple of times when the failure looks transient. */
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
