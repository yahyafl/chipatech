import { TrendingUp, Package, DollarSign, Activity, AlertCircle } from 'lucide-react'
import { KPICard } from '@/components/ui/KPICard'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useKPIs, useRecentTrades } from '@/hooks/useDashboard'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import type { Trade } from '@/types'

export default function PartnerDashboard() {
  const navigate = useNavigate()
  const { data: kpis, isLoading: kpisLoading } = useKPIs()
  const { data: trades, isLoading: tradesLoading } = useRecentTrades()

  const columns: Column<Trade>[] = [
    { key: 'trade_reference', header: 'Trade Ref', render: (row) => <span className="font-mono font-semibold text-brand-600">{row.trade_reference}</span> },
    { key: 'client', header: 'Client', render: (row) => row.client?.company_name ?? '—' },
    { key: 'entity', header: 'Entity', render: (row) => <span className="text-xs">{row.entity?.name ?? '—'}</span> },
    { key: 'contract_date', header: 'Date', render: (row) => formatDate(row.contract_date) },
    { key: 'frigo_total', header: 'Investment', render: (row) => formatCurrency(row.frigo_total) },
    { key: 'sale_total', header: 'Sale Total', render: (row) => formatCurrency(row.sale_total) },
    { key: 'net_profit', header: 'Net Profit', render: (row) => <span className={row.net_profit >= 0 ? 'font-semibold text-green-700' : 'font-semibold text-red-700'}>{formatCurrency(row.net_profit)}</span> },
    { key: 'trade_status', header: 'Status', render: (row) => <StatusBadge status={row.trade_status} /> },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Partner Portfolio</h1>
        <p className="mt-1 text-sm text-gray-500">Overview of all active trades and performance</p>
      </div>

      {kpisLoading ? (
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KPICard title="Total Trades" value={kpis?.totalTrades ?? 0} icon={Package} color="blue" />
          <KPICard title="Invested Capital" value={formatCurrency(kpis?.totalInvestedCapital ?? 0)} icon={DollarSign} color="purple" />
          <KPICard title="Total Net Profit" value={formatCurrency(kpis?.totalNetProfit ?? 0)} icon={TrendingUp} color="green" />
          <KPICard title="Active Trades" value={kpis?.activeTrades ?? 0} icon={Activity} color="yellow" />
          <KPICard title="Overdue Alerts" value={kpis?.overdueAlerts ?? 0} icon={AlertCircle} color={kpis?.overdueAlerts ? 'red' : 'gray'} />
        </div>
      )}

      <div className="rounded-xl bg-white border border-gray-200 shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Trade Portfolio</h2>
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
