import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { readCache, writeCache } from '@/lib/localCache'
import toast from 'react-hot-toast'
import type { Trade, TradeFilters, TradeStatus, MilestoneStatus } from '@/types'

const CACHE_TTL = 5 * 60 * 1000

const TRADE_SELECT = `
  *,
  entity:entities(*),
  client:clients(*),
  contact:contacts(*),
  bank_profile:bank_profiles(*)
`

export function useTrades(filters?: TradeFilters) {
  const cacheKey = filters ? `tm_trades_${JSON.stringify(filters)}` : 'tm_trades'
  const cached = readCache<Trade[]>(cacheKey, CACHE_TTL)

  return useQuery({
    queryKey: ['trades', filters],
    queryFn: async ({ signal }) => {
      let query = supabase
        .from('trades')
        .select(TRADE_SELECT)
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
  const cached = id ? readCache<Trade>(`tm_trade_${id}`, CACHE_TTL) : null

  return useQuery({
    queryKey: ['trades', id],
    queryFn: async ({ signal }) => {
      if (!id) return null
      const { data, error } = await supabase
        .from('trades')
        .select(TRADE_SELECT)
        .eq('id', id)
        .abortSignal(signal)
        .single()
      if (error) throw error
      writeCache(`tm_trade_${id}`, data)
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
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['trades'] })
      qc.invalidateQueries({ queryKey: ['trades', id] })
      toast.success('Trade status updated')
    },
  })
}

export function useMarkMilestoneReceived() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, milestone }: { id: string; milestone: 'advance' | 'balance' }) => {
      const field = milestone === 'advance'
        ? { advance_status: 'received' as MilestoneStatus, advance_received_at: new Date().toISOString() }
        : { balance_status: 'received' as MilestoneStatus, balance_received_at: new Date().toISOString() }
      const { error } = await supabase
        .from('trades')
        .update({ ...field, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { id, milestone }) => {
      qc.invalidateQueries({ queryKey: ['trades'] })
      qc.invalidateQueries({ queryKey: ['trades', id] })
      toast.success(`${milestone === 'advance' ? 'Advance' : 'Balance'} payment marked as received`)
    },
  })
}
