import { useState } from 'react'
import { Plus, Pencil, Trash2, Star, UserCircle } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { useContacts, useDeleteContact, useSetDefaultContact } from '@/hooks/useContacts'
import type { Contact } from '@/types'
import { ContactFormModal } from './ContactFormModal'
import { cn } from '@/lib/utils'

export default function ContactList() {
  const [showCreate, setShowCreate] = useState(false)
  const [editContact, setEditContact] = useState<Contact | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: contacts, isLoading } = useContacts()
  const { mutate: deleteContact, isPending: deleting } = useDeleteContact()
  const { mutate: setDefault } = useSetDefaultContact()

  const columns: Column<Contact>[] = [
    {
      key: 'full_name',
      header: 'Name',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{row.full_name}</span>
          {row.is_default && (
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">Default</span>
          )}
        </div>
      ),
    },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone' },
    { key: 'role', header: 'Role', render: (row) => row.role ?? '—' },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {!row.is_default && (
            <button
              onClick={() => setDefault(row.id)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-yellow-50 hover:text-yellow-600 transition-colors"
              title="Set as default"
            >
              <Star className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setEditContact(row)}
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
        title="Contact Library"
        subtitle="Internal contacts that appear on generated contracts"
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Contact
          </button>
        }
      />

      {!isLoading && contacts?.length === 0 ? (
        <EmptyState icon={UserCircle} title="No contacts yet" description="Add internal contacts who will appear on your contracts" actionLabel="Add Contact" onAction={() => setShowCreate(true)} />
      ) : (
        <DataTable columns={columns} data={contacts ?? []} isLoading={isLoading} emptyMessage="No contacts found" keyExtractor={(row) => row.id} />
      )}

      {(showCreate || editContact) && (
        <ContactFormModal contact={editContact} onClose={() => { setShowCreate(false); setEditContact(null) }} />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteContact(deleteId, { onSuccess: () => setDeleteId(null) }) }}
        title="Delete contact"
        description="Are you sure you want to delete this contact?"
        confirmLabel="Delete"
        isLoading={deleting}
      />
    </div>
  )
}
