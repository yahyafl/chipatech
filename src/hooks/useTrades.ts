import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { readCache, writeCache } from '@/lib/localCache'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'
import type { Trade, TradeFilters, TradeStatus, MilestoneStatus } from '@/types'

const CACHE_TTL = 5 * 60 * 1000

// Full select for super_admin / partner — includes financial columns and
// every join. Internal Team uses TRADE_SELECT_BASIC instead, which hits
// the trades_basic VIEW (no financial columns) and skips contact /
// bank_profile joins they don't have RLS access to anyway.
const TRADE_SELECT = `
  *,
  entity:entities(*),
  client:clients(*),
  contact:contacts(*),
  bank_profile:bank_profiles(*)
`

const TRADE_SELECT_BASIC = `
  *,
  entity:entities(*),
  client:clients(*)
`

export function useTrades(filters?: TradeFilters) {
  const { role } = useAuth()
  // Internal team must not see frigo_total / sale_total / net_profit /
  // total_costs / shipping / insurance / bank_fees. Routing those queries
  // through the trades_basic view enforces this at the DB layer, not just
  // in the UI.
  const isInternal = role === 'internal'
  const fromTable = isInternal ? 'trades_basic' : 'trades'
  const selectClause = isInternal ? TRADE_SELECT_BASIC : TRADE_SELECT

  const cacheKey = `${isInternal ? 'tm_trades_basic' : 'tm_trades'}${filters ? `_${JSON.stringify(filters)}` : ''}`
  const cached = readCache<Trade[]>(cacheKey, CACHE_TTL)

  return useQuery({
    queryKey: ['trades', isInternal, filters],
    queryFn: async ({ signal }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase.from(fromTable as any) as any)
        .select(selectClause)
        .order('created_at', { ascending: false })
        .abortSignal(signal)

      if (filters?.status)   query = query.eq('trade_status', filters.status)
      if (filters?.clientId) query = query.eq('client_id', filters.clientId)
      if (filters?.dateFrom) query = query.gte('contract_date', filters.dateFrom)
      if (filters?.dateTo)   query = query.lte('contract_date', filters.dateTo)
      if (filters?.search)   query = query.ilike('trade_reference', `%${filters.search}%`)

      const { data, error } = await query
      if (error) throw error
      writeCache(cacheKey, data)
      return data as Trade[]
    },
    initialData: cached ?? undefined,
    initialDataUpdatedAt: cached ? Date.now() - 1000 : undefined,
    staleTime: CACHE_TTL,
  })
}

export function useTrade(id: string | undefined) {
  const { role } = useAuth()
  // Same role-aware routing as useTrades(): internal users hit
  // trades_basic so financial columns aren't reachable via the singular
  // detail query either. Without this, an internal user opening any
  // /internal/trades/:id/folder would still pull frigo_total/sale_total
  // from `trades` directly.
  const isInternal = role === 'internal'
  const fromTable = isInternal ? 'trades_basic' : 'trades'
  const selectClause = isInternal ? TRADE_SELECT_BASIC : TRADE_SELECT
  const cacheKey = id ? `${isInternal ? 'tm_trade_basic_' : 'tm_trade_'}${id}` : null
  const cached = cacheKey ? readCache<Trade>(cacheKey, CACHE_TTL) : null

  return useQuery({
    queryKey: ['trades', id, isInternal],
    queryFn: async ({ signal }) => {
      if (!id) return null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from(fromTable as any) as any)
        .select(selectClause)
        .eq('id', id)
        .abortSignal(signal)
        .single()
      if (error) throw error
      if (cacheKey) writeCache(cacheKey, data)
      return data as Trade
    },
    enabled: !!id,
    initialData: cached ?? undefined,
    initialDataUpdatedAt: cached ? Date.now() - 1000 : undefined,
    staleTime: CACHE_TTL,
  })
}

export function useCreateTrade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Omit<Trade, 'id' | 'trade_reference' | 'created_at' | 'updated_at' | 'entity' | 'client' | 'contact' | 'bank_profile'>) => {
      const { count } = await supabase.from('trades').select('*', { count: 'exact', head: true })
      const year = new Date().getFullYear()
      const num = String((count ?? 0) + 1).padStart(3, '0')
      const trade_reference = `CF-${year}-${num}`
      const { data: created, error } = await supabase
        .from('trades').insert({ ...data, trade_reference }).select().single()
      if (error) throw error
      return created as Trade
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trades'] })
      toast.success('Trade created successfully')
    },
  })
}

export function useUpdateTrade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Trade> }) => {
      const { entity: _e, client: _c, contact: _co, bank_profile: _b, ...dbData } = data
      const { data: updated, error } = await supabase
        .from('trades')
        .update({ ...dbData, updated_at: new Date().toISOString() })
        .eq('id', id).select().single()
      if (error) throw error
      return updated as Trade
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['trades'] })
      qc.invalidateQueries({ queryKey: ['trades', id] })
    },
  })
}

export function useUpdateTradeStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TradeStatus }) => {
      const { error } = await supabase
        .from('trades')
        .update({ trade_status: status, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      // Notify the client contact whenever the lifecycle advances
      void supabase.functions.invoke('send-status-email', {
        body: { trade_id: id, status },
      })
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['trades'] })
      qc.invalidateQueries({ queryKey: ['trades', id] })
      toast.success('Trade status updated')
    },
  })
}

// Status timeline rank — higher = later in the lifecycle. We never let a
// later status be overwritten by an earlier one (e.g. clicking "Mark Advance"
// on an already-shipped trade must NOT regress the status to advance_received).
const STATUS_RANK: Record<TradeStatus, number> = {
  draft: 0,
  active: 1,
  advance_received: 2,
  shipped: 3,
  balance_received: 4,
  overdue: -1, // overdue is a parallel state; never auto-overwritten by milestone marking
}

export function useMarkMilestoneReceived() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, milestone }: { id: string; milestone: 'advance' | 'balance' }) => {
      // Read current trade_status so we only move forward, never backward.
      const { data: current } = await supabase
        .from('trades')
        .select('trade_status, client:clients(contact_email, contact_name, company_name)')
        .eq('id', id)
        .single()

      const currentStatus = (current?.trade_status as TradeStatus | undefined) ?? 'draft'
      const targetStatus: TradeStatus = milestone === 'advance' ? 'advance_received' : 'balance_received'
      const shouldAdvanceStatus = STATUS_RANK[targetStatus] > STATUS_RANK[currentStatus]

      const milestoneFields = milestone === 'advance'
        ? { advance_status: 'received' as MilestoneStatus, advance_received_at: new Date().toISOString() }
        : { balance_status: 'received' as MilestoneStatus, balance_received_at: new Date().toISOString() }

      const update = {
        ...milestoneFields,
        ...(shouldAdvanceStatus ? { trade_status: targetStatus } : {}),
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase.from('trades').update(update).eq('id', id)
      if (error) throw error

      // Notify the client contact when the trade lifecycle actually advances
      if (shouldAdvanceStatus) {
        void supabase.functions.invoke('send-status-email', {
          body: { trade_id: id, status: targetStatus },
        })
      }
    },
    onSuccess: (_, { id, milestone }) => {
      qc.invalidateQueries({ queryKey: ['trades'] })
      qc.invalidateQueries({ queryKey: ['trades', id] })
      toast.success(`${milestone === 'advance' ? 'Advance' : 'Balance'} payment marked as received`)
    },
  })
}
