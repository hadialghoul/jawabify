import { useCallback, useRef, useState } from 'react';

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

export function useCachedState<T>(key: string | null, initial: T) {
  const [state, setState] = useState<T>(() => readCache<T>(key) ?? initial);
  const keyRef = useRef(key);

  if (keyRef.current !== key) {
    keyRef.current = key;
    const seeded = readCache<T>(key);
    if (seeded !== undefined) {
      if (seeded !== state) setState(seeded);
    } else if (state !== initial) {
      setState(initial);
    }
  }

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setState((prev) => {
      const value = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      writeCache(keyRef.current, value);
      return value;
    });
  }, []);

  return [state, set] as const;
}
