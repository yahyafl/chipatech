import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const fetchWithTimeout: typeof fetch = async (url, init) => {
  const controller = new AbortController()
  const callerSignal = (init as RequestInit | undefined)?.signal as AbortSignal | undefined
  if (callerSignal) callerSignal.addEventListener('abort', () => controller.abort())
  const timer = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), 15_000)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: { fetch: fetchWithTimeout },
})

export type SupabaseClient = typeof supabase
