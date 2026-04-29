import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  DEFAULT_ENTITIES,
  DEFAULT_BANK_PROFILES,
  DEFAULT_CLIENTS,
  DEFAULT_CONTACTS,
} from '@/lib/defaultSetupData'
import type { Entity, BankProfile, Client, Contact } from '@/types'

export interface WizardSetupData {
  entities: Entity[]
  bank_profiles: BankProfile[]
  clients: Client[]
  contacts: Contact[]
}

const CACHE_KEY = 'tm_wizard_setup'
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

function readCache(): WizardSetupData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw) as { data: WizardSetupData; ts: number }
    if (Date.now() - ts > CACHE_TTL) return null
    return data
  } catch {
    return null
  }
}

function writeCache(data: WizardSetupData) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }))
  } catch { /* quota */ }
}

const DEFAULT_DATA: WizardSetupData = {
  entities:      DEFAULT_ENTITIES,
  bank_profiles: DEFAULT_BANK_PROFILES,
  clients:       DEFAULT_CLIENTS,
  contacts:      DEFAULT_CONTACTS,
}

export function useWizardSetupData() {
  // Seed: use localStorage cache → fall back to hardcoded defaults.
  // Either way the UI renders instantly with real data.
  const cached = readCache()
  const [data,      setData]      = useState<WizardSetupData>(cached ?? DEFAULT_DATA)
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const { signal } = controller

    async function sync() {
      setIsLoading(true)
      setError(null)
      try {
        // Try the single-RPC path first (fastest — one round trip)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rpcData, error: rpcErr } = await (supabase as any)
          .rpc('get_wizard_setup_data', {}, { signal })

        if (cancelled) return

        if (!rpcErr && rpcData) {
          const fresh = rpcData as WizardSetupData
          setData(fresh)
          writeCache(fresh)
          return
        }

        // RPC not available — fall back to 4 parallel table queries
        const [ent, bp, cli, con] = await Promise.all([
          supabase.from('entities').select('*').order('name').abortSignal(signal),
          supabase.from('bank_profiles').select('*').order('is_default', { ascending: false }).abortSignal(signal),
          supabase.from('clients').select('*').order('company_name').abortSignal(signal),
          supabase.from('contacts').select('*').order('is_default', { ascending: false }).order('full_name').abortSignal(signal),
        ])

        if (cancelled) return

        const firstErr = ent.error ?? bp.error ?? cli.error ?? con.error
        if (firstErr) throw new Error(firstErr.message)

        const fresh: WizardSetupData = {
          entities:      (ent.data  ?? []) as Entity[],
          bank_profiles: (bp.data   ?? []) as BankProfile[],
          clients:       (cli.data  ?? []) as Client[],
          contacts:      (con.data  ?? []) as Contact[],
        }
        setData(fresh)
        writeCache(fresh)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)))
        // Keep showing defaults — don't clear the working data
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void sync()
    return () => { cancelled = true; controller.abort() }
  }, [])

  return { data, isLoading, error }
}
