import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { SearchInput } from '@/components/ui/SearchInput'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { useClients, useDeleteClient } from '@/hooks/useClients'
import type { Client } from '@/types'
import { ClientFormModal } from './ClientFormModal'

export default function ClientList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: clients, isLoading } = useClients(search)
  const { mutate: deleteClient, isPending: deleting } = useDeleteClient()

  const columns: Column<Client>[] = [
    {
      key: 'company_name',
      header: 'Company',
      sortable: true,
      render: (row) => <span className="font-medium text-gray-900">{row.company_name}</span>,
    },
    { key: 'country', header: 'Country', sortable: true },
    { key: 'contact_name', header: 'Contact Person' },
    { key: 'contact_email', header: 'Email' },
    { key: 'contact_phone', header: 'Phone' },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setEditClient(row)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDeleteId(row.id)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        subtitle="Manage your buyer and client records"
        actions={
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Client
          </button>
        }
      />

      <div className="flex items-center gap-3">
        <SearchInput placeholder="Search clients..." onSearch={setSearch} className="max-w-xs" />
      </div>

      {isLoading ? null : clients?.length === 0 && !search ? (
        <EmptyState
          icon={Users}
          title="No clients yet"
          description="Add your first client to get started"
          actionLabel="Add Client"
          onAction={() => setShowCreateModal(true)}
        />
      ) : (
        <DataTable
          columns={columns}
          data={clients ?? []}
          isLoading={isLoading}
          emptyMessage="No clients found"
          keyExtractor={(row) => row.id}
        />
      )}

      {(showCreateModal || editClient) && (
        <ClientFormModal
          client={editClient}
          onClose={() => { setShowCreateModal(false); setEditClient(null) }}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteClient(deleteId, { onSuccess: () => setDeleteId(null) })
        }}
        title="Delete client"
        description="Are you sure you want to delete this client? This action cannot be undone."
        confirmLabel="Delete"
        isLoading={deleting}
      />
    </div>
  )
}
