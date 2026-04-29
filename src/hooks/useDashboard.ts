import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { DashboardKPIs, Trade } from '@/types'

export function useKPIs() {
  return useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: async (): Promise<DashboardKPIs> => {
      const { data: trades, error } = await supabase
        .from('trades')
        .select('trade_status, advance_status, balance_status, sale_total, frigo_total, net_profit')
      if (error) throw error

      const activeTrades = trades.filter((t) =>
        ['active', 'advance_received', 'shipped'].includes(t.trade_status)
      ).length

      const totalRevenue = trades.reduce((sum, t) => sum + (t.sale_total ?? 0), 0)

      const pendingMilestones = trades.filter(
        (t) => t.advance_status === 'pending' || t.balance_status === 'pending'
      ).length

      const overdueAlerts = trades.filter(
        (t) => t.advance_status === 'overdue' || t.balance_status === 'overdue' || t.trade_status === 'overdue'
      ).length

      const totalInvestedCapital = trades.reduce((sum, t) => sum + (t.frigo_total ?? 0), 0)
      const totalNetProfit = trades.reduce((sum, t) => sum + (t.net_profit ?? 0), 0)

      return {
        activeTrades,
        totalRevenue,
        pendingMilestones,
        overdueAlerts,
        totalTrades: trades.length,
        totalInvestedCapital,
        totalNetProfit,
      }
    },
  })
}

export function useRecentTrades() {
  return useQuery({
    queryKey: ['dashboard', 'recent-trades'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trades')
        .select('*, entity:entities(*), client:clients(*)')
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data as Trade[]
    },
  })
}

export function useOverdueMilestones() {
  return useQuery({
    queryKey: ['dashboard', 'overdue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trades')
        .select('*, client:clients(*)')
        .or('advance_status.eq.overdue,balance_status.eq.overdue,trade_status.eq.overdue')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data as Trade[]
    },
  })
}
