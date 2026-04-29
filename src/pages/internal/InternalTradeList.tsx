import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { SearchInput } from '@/components/ui/SearchInput'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useTrades } from '@/hooks/useTrades'
import { formatDate } from '@/lib/utils'
import type { Trade, TradeFilters } from '@/types'

export default function InternalTradeList() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<TradeFilters>({})
  const { data: trades, isLoading } = useTrades(filters)

  const columns: Column<Trade>[] = [
    { key: 'trade_reference', header: 'Trade Ref', render: (row) => <span className="font-mono font-semibold text-brand-600">{row.trade_reference}</span> },
    { key: 'client', header: 'Client', render: (row) => row.client?.company_name ?? '—' },
    { key: 'contract_date', header: 'Date', render: (row) => formatDate(row.contract_date) },
    { key: 'trade_status', header: 'Status', render: (row) => <StatusBadge status={row.trade_status} /> },
    { key: 'advance_status', header: 'Advance', render: (row) => <StatusBadge status={row.advance_status} /> },
    { key: 'balance_status', header: 'Balance', render: (row) => <StatusBadge status={row.balance_status} /> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Trades" subtitle="View trade status and upload documents" />
      <SearchInput placeholder="Search..." onSearch={(s) => setFilters((f) => ({ ...f, search: s }))} className="max-w-xs" />
      <DataTable
        columns={columns}
        data={trades ?? []}
        isLoading={isLoading}
        emptyMessage="No trades"
        onRowClick={(row) => navigate(`/internal/trades/${row.id}/folder`)}
        keyExtractor={(row) => row.id}
      />
    </div>
  )
}
