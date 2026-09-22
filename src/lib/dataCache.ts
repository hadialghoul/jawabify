import { useCallback, useRef, useState } from 'react';

/**
 * Tiny in-memory stale-while-revalidate cache.
 *
 * Dashboard tabs unmount when you switch away, so every hook used to refetch
 * from zero and flash a skeleton. Hooks seed their state from this cache so a
 * revisited tab renders instantly and only revalidates in the background.
 */
type Entry = { value: unknown; ts: number };

const store = new Map<string, Entry>();

export function readCache<T>(key: string | null | undefined): T | undefined {
  if (!key) return undefined;
  const entry = store.get(key);
  return entry ? (entry.value as T) : undefined;
}

export function writeCache<T>(key: string | null | undefined, value: T) {
  if (!key) return;
  store.set(key, { value, ts: Date.now() });
}

export function hasCache(key: string | null | undefined): boolean {
  return !!key && store.has(key);
}

/** True when the cached entry exists and is younger than `ttl` ms. */
export function isFresh(key: string | null | undefined, ttl: number): boolean {
  if (!key) return false;
  const entry = store.get(key);
  return !!entry && Date.now() - entry.ts < ttl;
}

export function invalidateCache(prefix?: string) {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/**
 * useState that seeds from (and writes through to) the cache for `key`.
 * Changing the key re-seeds from that key's cached snapshot.
 */
export function useCachedState<T>(key: string | null, initial: T) {
  const [state, setState] = useState<T>(() => readCache<T>(key) ?? initial);
  const keyRef = useRef(key);

  if (keyRef.current !== key) {
    keyRef.current = key;
    // Re-seed synchronously on key change (tenant switch, new date range).
    const seeded = readCache<T>(key);
    if (seeded !== undefined) {
      if (seeded !== state) setState(seeded);
    } else if (state !== initial) {
      setState(initial);
    }
  }

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setState((prev) => {
        const value = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        writeCache(keyRef.current, value);
        return value;
      });
    },
    [],
  );

  return [state, set] as const;
}
