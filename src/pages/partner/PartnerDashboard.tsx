import { TrendingUp, Package, DollarSign, Activity, AlertCircle, Wallet } from 'lucide-react'
import { KPICard } from '@/components/ui/KPICard'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useKPIs } from '@/hooks/useDashboard'
import { useTrades } from '@/hooks/useTrades'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import type { Trade } from '@/types'

export default function PartnerDashboard() {
  const navigate = useNavigate()
  const { data: kpis, isLoading: kpisLoading } = useKPIs()
  // Per spec §3.3 the dashboard IS the portfolio — Partner needs to see
  // every trade, not just the most-recent 10. useTrades returns the full
  // list (paginated client-side by DataTable when >page-size).
  const { data: trades, isLoading: tradesLoading } = useTrades()

  // Per PRD §3.3 Partner sees Frigo buy price + sale price + itemized
  // costs + net profit. Only the profit-split is hidden (which we never
  // store anywhere, so nothing to filter).
  const columns: Column<Trade>[] = [
    { key: 'trade_reference', header: 'Trade Ref', render: (row) => <span className="font-mono font-semibold text-brand-600">{row.trade_reference}</span> },
    { key: 'client', header: 'Client', render: (row) => row.client?.company_name ?? '—' },
    { key: 'entity', header: 'Entity', render: (row) => <span className="text-xs">{row.entity?.name ?? '—'}</span> },
    { key: 'contract_date', header: 'Date', render: (row) => formatDate(row.contract_date) },
    { key: 'frigo_total', header: 'Frigo Cost', render: (row) => formatCurrency(row.frigo_total) },
    { key: 'sale_total', header: 'Sale Total', render: (row) => formatCurrency(row.sale_total) },
    { key: 'net_profit', header: 'Net Profit', render: (row) => <span className={row.net_profit >= 0 ? 'font-semibold text-green-700' : 'font-semibold text-red-700'}>{formatCurrency(row.net_profit)}</span> },
    { key: 'trade_status', header: 'Status', render: (row) => <StatusBadge status={row.trade_status} /> },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Partner Portfolio</h1>
        <p className="mt-1 text-sm text-gray-500">Overview of all trades, costs, and performance</p>
      </div>

      {kpisLoading ? (
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <KPICard title="Total Trades" value={kpis?.totalTrades ?? 0} icon={Package} color="blue" />
          <KPICard title="Total Investment" value={formatCurrency(kpis?.totalInvestedCapital ?? 0)} icon={Wallet} color="purple" />
          <KPICard title="Total Sales" value={formatCurrency(kpis?.totalRevenue ?? 0)} icon={DollarSign} color="purple" />
          <KPICard title="Total Net Profit" value={formatCurrency(kpis?.totalNetProfit ?? 0)} icon={TrendingUp} color="green" />
          <KPICard title="Active Trades" value={kpis?.activeTrades ?? 0} icon={Activity} color="yellow" />
          <KPICard title="Overdue Alerts" value={kpis?.overdueAlerts ?? 0} icon={AlertCircle} color={kpis?.overdueAlerts ? 'red' : 'gray'} />
        </div>
      )}

      <div className="rounded-xl bg-white border border-gray-200 shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Trade Portfolio</h2>
          <span className="text-xs text-gray-500">{trades?.length ?? 0} trade{(trades?.length ?? 0) === 1 ? '' : 's'}</span>
        </div>
        <div className="p-4">
          <DataTable
            columns={columns}
            data={trades ?? []}
            isLoading={tradesLoading}
            emptyMessage="No trades yet"
            onRowClick={(row) => navigate(`/partner/trades/${row.id}`)}
            keyExtractor={(row) => row.id}
          />
        </div>
      </div>
    </div>
  )
}
