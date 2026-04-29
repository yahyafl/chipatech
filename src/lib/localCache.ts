// Thin localStorage cache used by all Supabase hooks.
// Lets every page render immediately with the last-known data
// while a background sync quietly refreshes it.

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

export function writeCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }))
  } catch { /* storage quota */ }
}

export function clearCache(key: string): void {
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}
