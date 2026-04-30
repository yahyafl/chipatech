import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus, Pencil, Power, Trash2 } from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { FormField, Input, Select } from '@/components/ui/FormField'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useUsers, useInviteUser, useUpdateUser, useDeactivateUser, useReactivateUser, useDeleteUser } from '@/hooks/useUsers'
import { useAuth } from '@/context/AuthContext'
import { inviteUserSchema, type InviteUserFormData, type User, type UserRole } from '@/types'
import { formatDate, timeAgo } from '@/lib/utils'

export default function UserManagement() {
  const { user: currentUser } = useAuth()
  const { data: users, isLoading } = useUsers()
  const { mutate: inviteUser, isPending: inviting } = useInviteUser()
  const { mutate: updateUser, isPending: updatingUser } = useUpdateUser()
  const { mutate: deactivate, isPending: deactivating } = useDeactivateUser()
  const { mutate: reactivate, isPending: reactivating } = useReactivateUser()
  const { mutate: deleteUser, isPending: deleting } = useDeleteUser()
  const [showInvite, setShowInvite] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [editTarget, setEditTarget] = useState<User | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<UserRole>('internal')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<InviteUserFormData>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: { role: 'internal' },
  })

  const onInvite = (data: InviteUserFormData) => {
    inviteUser(data, { onSuccess: () => { setShowInvite(false); reset() } })
  }

  const columns: Column<User>[] = [
    {
      key: 'full_name',
      header: 'Name',
      render: (row) => <span className="font-medium text-gray-900">{row.full_name}</span>,
    },
    { key: 'email', header: 'Email' },
    {
      key: 'role',
      header: 'Role',
      render: (row) => (
        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 capitalize">
          {row.role.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => (
        row.is_active ? (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Active</span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">Inactive</span>
        )
      ),
    },
    {
      key: 'last_login_at',
      header: 'Last Login',
      render: (row) => row.last_login_at ? timeAgo(row.last_login_at) : 'Never',
    },
    {
      key: 'actions',
      header: '',
      render: (row) => {
        if (row.id === currentUser?.id) return <span className="text-xs text-gray-400">You</span>
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => { setEditTarget(row); setEditName(row.full_name); setEditRole(row.role) }}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="Edit user"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDeactivateTarget(row)}
              className={`rounded-lg p-1.5 transition-colors ${row.is_active ? 'text-gray-400 hover:bg-red-50 hover:text-red-600' : 'text-green-500 hover:bg-green-50'}`}
              title={row.is_active ? 'Deactivate' : 'Reactivate'}
            >
              <Power className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDeleteTarget(row)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
              title="Delete permanently"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Platform Users</h2>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Invite User
        </button>
      </div>

      <DataTable columns={columns} data={users ?? []} isLoading={isLoading} emptyMessage="No users found" keyExtractor={(row) => row.id} />

      {/* Invite Modal */}
      <Modal open={showInvite} onClose={() => { setShowInvite(false); reset() }} title="Invite User" description="Send an invitation email to a new user."
        footer={
          <>
            <button onClick={() => { setShowInvite(false); reset() }} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSubmit(onInvite)} disabled={inviting} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {inviting && <LoadingSpinner size="sm" />}
              Send Invitation
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Full Name" error={errors.full_name} required>
            <Input error={!!errors.full_name} {...register('full_name')} />
          </FormField>
          <FormField label="Email" error={errors.email} required>
            <Input type="email" error={!!errors.email} {...register('email')} />
          </FormField>
          <FormField label="Role" error={errors.role} required>
            <Select error={!!errors.role} {...register('role')}>
              <option value="internal">Internal Team Member</option>
              <option value="partner">Partner (Financier)</option>
              <option value="super_admin">Super Admin</option>
            </Select>
          </FormField>
        </div>
      </Modal>

      {/* Edit User Modal — name + role per PRD §2.4. Status (active /
          inactive) is changed via the dedicated Power toggle button so the
          dedicated edge function can also revoke the auth session. */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit User"
        footer={
          <>
            <button onClick={() => setEditTarget(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={() => {
              if (!editTarget) return
              const trimmed = editName.trim()
              if (trimmed.length < 2) return
              updateUser(
                { id: editTarget.id, full_name: trimmed, role: editRole },
                { onSuccess: () => setEditTarget(null) },
              )
            }} disabled={updatingUser || editName.trim().length < 2} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {updatingUser && <LoadingSpinner size="sm" />}
              Save
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{editTarget?.email}</p>
          <FormField label="Full Name" required>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </FormField>
          <FormField label="Role">
            <Select value={editRole} onChange={(e) => setEditRole(e.target.value as UserRole)}>
              <option value="internal">Internal Team Member</option>
              <option value="partner">Partner (Financier)</option>
              <option value="super_admin">Super Admin</option>
            </Select>
          </FormField>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => {
          if (!deactivateTarget) return
          if (deactivateTarget.is_active) {
            deactivate(deactivateTarget.id, { onSuccess: () => setDeactivateTarget(null) })
          } else {
            reactivate(deactivateTarget.id, { onSuccess: () => setDeactivateTarget(null) })
          }
        }}
        title={deactivateTarget?.is_active ? 'Deactivate User' : 'Reactivate User'}
        description={deactivateTarget?.is_active
          ? `Deactivate ${deactivateTarget?.full_name}? They will be locked out immediately.`
          : `Reactivate ${deactivateTarget?.full_name}? They will regain access.`}
        confirmLabel={deactivateTarget?.is_active ? 'Deactivate' : 'Reactivate'}
        isLoading={deactivating || reactivating}
        variant={deactivateTarget?.is_active ? 'danger' : 'warning'}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          deleteUser(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
        }}
        title="Delete user permanently"
        description={`This will permanently delete ${deleteTarget?.full_name} (${deleteTarget?.email}) and remove their access. This cannot be undone.`}
        confirmLabel="Delete permanently"
        isLoading={deleting}
        variant="danger"
      />
    </div>
  )
}
