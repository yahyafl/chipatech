import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { SearchInput } from '@/components/ui/SearchInput'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Select } from '@/components/ui/FormField'
import { useTrades } from '@/hooks/useTrades'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency, formatDate, downloadBlob } from '@/lib/utils'
import type { Trade, TradeStatus, TradeFilters } from '@/types'

const STATUS_OPTIONS: { value: TradeStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'advance_received', label: 'Advance Received' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'balance_received', label: 'Balance Received' },
  { value: 'overdue', label: 'Overdue' },
]

function exportToCSV(trades: Trade[]) {
  const headers = ['Trade Ref', 'Client', 'Entity', 'Contract Date', 'Sale Total', 'Net Profit', 'Status', 'Advance', 'Balance']
  const rows = trades.map((t) => [
    t.trade_reference,
    t.client?.company_name ?? '',
    t.entity?.name ?? '',
    t.contract_date,
    t.sale_total,
    t.net_profit,
    t.trade_status,
    t.advance_status,
    t.balance_status,
  ])
  const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
  downloadBlob(new Blob([csv], { type: 'text/csv' }), 'trades.csv')
}

export default function TradeList() {
  const navigate = useNavigate()
  const { role } = useAuth()
  const isSuperAdmin = role === 'super_admin'
  const [filters, setFilters] = useState<TradeFilters>({})
  const { data: trades, isLoading } = useTrades(filters)

  const columns: Column<Trade>[] = [
    {
      key: 'trade_reference',
      header: 'Trade Ref',
      sortable: true,
      render: (row) => <span className="font-mono font-semibold text-brand-600">{row.trade_reference}</span>,
    },
    {
      key: 'client',
      header: 'Client',
      render: (row) => row.client?.company_name ?? '—',
    },
    {
      key: 'entity',
      header: 'Entity',
      render: (row) => <span className="text-xs">{row.entity?.name ?? '—'}</span>,
    },
    {
      key: 'contract_date',
      header: 'Date',
      sortable: true,
      render: (row) => formatDate(row.contract_date),
    },
    ...(isSuperAdmin ? [{
      key: 'frigo_total',
      header: 'Frigo Price',
      render: (row: Trade) => formatCurrency(row.frigo_total),
    }] : []),
    {
      key: 'sale_total',
      header: 'Sale Total',
      render: (row) => formatCurrency(row.sale_total),
    },
    ...(isSuperAdmin ? [{
      key: 'net_profit',
      header: 'Net Profit',
      render: (row: Trade) => (
        <span className={row.net_profit >= 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
          {formatCurrency(row.net_profit)}
        </span>
      ),
    }] : []),
    {
      key: 'trade_status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.trade_status} />,
    },
    {
      key: 'advance_status',
      header: 'Advance',
      render: (row) => <StatusBadge status={row.advance_status} />,
    },
    {
      key: 'balance_status',
      header: 'Balance',
      render: (row) => <StatusBadge status={row.balance_status} />,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trades"
        subtitle="All trade records"
        actions={
          <button
            onClick={() => exportToCSV(trades ?? [])}
            disabled={!trades?.length}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        }
      />

      <div className="flex items-center gap-3 flex-wrap">
        <SearchInput placeholder="Search by reference..." onSearch={(s) => setFilters((f) => ({ ...f, search: s }))} className="max-w-xs" />
        <Select
          value={filters.status ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as TradeStatus | undefined || undefined }))}
          className="w-48"
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <input
          type="date"
          value={filters.dateFrom ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined }))}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          placeholder="From date"
        />
        <input
          type="date"
          value={filters.dateTo ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value || undefined }))}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
      </div>

      <DataTable
        columns={columns}
        data={trades ?? []}
        isLoading={isLoading}
        emptyMessage="No trades found"
        onRowClick={(row) => navigate(`/trades/${row.id}`)}
        keyExtractor={(row) => row.id}
      />
    </div>
  )
}
