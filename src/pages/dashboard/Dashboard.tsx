import { Link, useNavigate } from 'react-router-dom'
import { Plus, AlertTriangle, TrendingUp, Activity, Clock, AlertCircle } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { KPICard } from '@/components/ui/KPICard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useKPIs, useRecentTrades, useOverdueMilestones } from '@/hooks/useDashboard'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Trade } from '@/types'

export default function Dashboard() {
  const navigate = useNavigate()
  const { data: kpis, isLoading: kpisLoading } = useKPIs()
  const { data: recentTrades, isLoading: tradesLoading } = useRecentTrades()
  const { data: overdues } = useOverdueMilestones()

  const tradeColumns: Column<Trade>[] = [
    {
      key: 'trade_reference',
      header: 'Trade Ref',
      render: (row) => (
        <span className="font-mono text-sm font-semibold text-brand-600">{row.trade_reference}</span>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      render: (row) => <span>{row.client?.company_name ?? '—'}</span>,
    },
    {
      key: 'contract_date',
      header: 'Date',
      render: (row) => formatDate(row.contract_date),
    },
    {
      key: 'sale_total',
      header: 'Sale Total',
      render: (row) => formatCurrency(row.sale_total),
    },
    {
      key: 'trade_status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.trade_status} />,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your trading operations"
        actions={
          <Link
            to="/contracts/new"
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Contract
          </Link>
        }
      />

      {/* Overdue Alert Banner */}
      {overdues && overdues.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800">Overdue Payment Alerts</h3>
              <p className="mt-1 text-sm text-red-700">
                {overdues.length} trade{overdues.length !== 1 ? 's' : ''} have overdue milestones
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {overdues.slice(0, 5).map((trade) => (
                  <Link
                    key={trade.id}
                    to={`/trades/${trade.id}`}
                    className="rounded-lg bg-red-100 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-200 transition-colors"
                  >
                    {trade.trade_reference} — {trade.client?.company_name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      {kpisLoading ? (
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KPICard
            title="Active Trades"
            value={kpis?.activeTrades ?? 0}
            icon={Activity}
            color="blue"
            subtitle="In progress"
          />
          <KPICard
            title="Total Revenue"
            value={formatCurrency(kpis?.totalRevenue ?? 0)}
            icon={TrendingUp}
            color="green"
            subtitle="All time"
          />
          <KPICard
            title="Pending Milestones"
            value={kpis?.pendingMilestones ?? 0}
            icon={Clock}
            color="yellow"
            subtitle="Awaiting payment"
          />
          <KPICard
            title="Overdue Alerts"
            value={kpis?.overdueAlerts ?? 0}
            icon={AlertCircle}
            color={kpis?.overdueAlerts ? 'red' : 'gray'}
            subtitle="Require attention"
          />
        </div>
      )}

      {/* Recent Trades */}
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Recent Trades</h2>
          <Link to="/trades" className="text-sm text-brand-600 hover:text-brand-700 transition-colors">
            View all →
          </Link>
        </div>
        <div className="p-4">
          <DataTable
            columns={tradeColumns}
            data={recentTrades ?? []}
            isLoading={tradesLoading}
            emptyMessage="No trades yet. Create your first contract."
            onRowClick={(row) => navigate(`/trades/${row.id}`)}
            keyExtractor={(row) => row.id}
          />
        </div>
      </div>
    </div>
  )
}
