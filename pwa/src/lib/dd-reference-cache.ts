/** 認可済みの参照本文だけを短時間共有する。権限・公開判定・監査には使わない。 */
export function createDdReferenceCache<T>({ ttlMs = 30_000, maxEntries = 128, now = Date.now } = {}) {
  const entries = new Map<string, { expiresAt: number; value: Promise<T> }>();
  return {
    load(key: string, loader: () => Promise<T>, fresh = false): Promise<T> {
      const cached = entries.get(key);
      if (!fresh && cached && cached.expiresAt > now()) return cached.value;
      const entry = { expiresAt: Infinity, value: undefined as unknown as Promise<T> };
      entry.value = Promise.resolve().then(loader).then(value => {
        entry.expiresAt = now() + ttlMs;
        return value;
      }).catch(error => {
        if (entries.get(key) === entry) entries.delete(key);
        throw error;
      });
      entries.delete(key);
      entries.set(key, entry);
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
      return entry.value;
    },
  };
}
