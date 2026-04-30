// Thin localStorage cache used by all Supabase hooks.
// Lets every page render immediately with the last-known data
// while a background sync quietly refreshes it.

const CACHE_PREFIX = 'tm_'

export function readCache<T>(key: string, ttlMs: number): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw) as { data: T; ts: number }
    return Date.now() - ts < ttlMs ? data : null
  } catch {
    return null
  }
}

// Audit M-3: previously a quota-exceeded error silently broke the cache.
// Now we evict the oldest tm_* entries and retry once before giving up.
function evictOldestEntries(neededBytes: number) {
  const entries: Array<{ key: string; ts: number; size: number }> = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k || !k.startsWith(CACHE_PREFIX)) continue
    try {
      const v = localStorage.getItem(k) ?? ''
      const { ts } = JSON.parse(v) as { ts: number }
      entries.push({ key: k, ts: typeof ts === 'number' ? ts : 0, size: v.length })
    } catch {
      // Corrupt entry — treat as ancient so it's evicted first
      entries.push({ key: k, ts: 0, size: 0 })
    }
  }
  entries.sort((a, b) => a.ts - b.ts) // oldest first
  let freed = 0
  for (const e of entries) {
    try { localStorage.removeItem(e.key) } catch { /* ignore */ }
    freed += e.size
    if (freed >= neededBytes) break
  }
}

export function writeCache<T>(key: string, data: T): void {
  const payload = JSON.stringify({ data, ts: Date.now() })
  try {
    localStorage.setItem(key, payload)
  } catch (e) {
    // Most browsers throw QuotaExceededError; older Safari uses code 22
    const isQuota = e instanceof Error && (
      e.name === 'QuotaExceededError' ||
      ('code' in e && (e as { code?: number }).code === 22)
    )
    if (!isQuota) return
    evictOldestEntries(payload.length * 2)
    try { localStorage.setItem(key, payload) } catch { /* give up */ }
  }
}

export function clearCache(key: string): void {
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}
