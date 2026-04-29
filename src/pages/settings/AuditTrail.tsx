import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { formatDatetime } from '@/lib/utils'
import type { AuditLog } from '@/types'

export default function AuditTrail() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*, user:users(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data as AuditLog[]
    },
  })

  const columns: Column<AuditLog>[] = [
    {
      key: 'created_at',
      header: 'Time',
      render: (row) => <span className="text-xs text-gray-500">{formatDatetime(row.created_at)}</span>,
    },
    {
      key: 'user',
      header: 'User',
      render: (row) => <span className="text-sm">{row.user?.full_name ?? 'System'}</span>,
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-mono">{row.action}</span>,
    },
    { key: 'entity_type', header: 'Entity Type' },
    {
      key: 'entity_id',
      header: 'Entity ID',
      render: (row) => <span className="text-xs font-mono text-gray-500">{row.entity_id?.substring(0, 8) ?? '—'}</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Audit Trail</h2>
        <p className="text-sm text-gray-500">All significant platform actions</p>
      </div>
      <DataTable columns={columns} data={logs ?? []} isLoading={isLoading} emptyMessage="No audit logs yet" keyExtractor={(row) => row.id} />
    </div>
  )
}
