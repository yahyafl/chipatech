import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { FormField, Input } from '@/components/ui/FormField'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useEntities, useCreateEntity, useUpdateEntity, useDeleteEntity } from '@/hooks/useEntities'
import { entitySchema, type EntityFormData, type Entity } from '@/types'

export default function EntityProfiles() {
  const { data: entities, isLoading } = useEntities()
  const { mutate: createEntity, isPending: creating } = useCreateEntity()
  const { mutate: updateEntity, isPending: updating } = useUpdateEntity()
  const { mutate: deleteEntity, isPending: deleting } = useDeleteEntity()
  const [showCreate, setShowCreate] = useState(false)
  const [editEntity, setEditEntity] = useState<Entity | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Entity | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EntityFormData>({
    resolver: zodResolver(entitySchema) as never,
  })

  const onSubmit = (data: EntityFormData) => {
    if (editEntity) {
      updateEntity({ id: editEntity.id, data }, { onSuccess: () => { setEditEntity(null); reset() } })
    } else {
      createEntity(data, { onSuccess: () => { setShowCreate(false); reset() } })
    }
  }

  const columns: Column<Entity>[] = [
    { key: 'name', header: 'Legal Name', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'country', header: 'Country' },
    { key: 'ruc_ein', header: 'RUC / EIN' },
    { key: 'city', header: 'City' },
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => row.is_active ? <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Active</span> : <span className="text-xs text-gray-500">Inactive</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => { setEditEntity(row); reset(row) }}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="Edit entity"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(row)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Delete entity"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Entity Profiles</h2>
        <button type="button" onClick={() => { setShowCreate(true); reset({}) }} className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" />Add Entity
        </button>
      </div>
      <DataTable columns={columns} data={entities ?? []} isLoading={isLoading} emptyMessage="No entities found" keyExtractor={(row) => row.id} />

      <Modal open={showCreate || !!editEntity} onClose={() => { setShowCreate(false); setEditEntity(null); reset() }}
        title={editEntity ? 'Edit Entity' : 'Add Entity'}
        footer={
          <>
            <button type="button" onClick={() => { setShowCreate(false); setEditEntity(null); reset() }} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="button" onClick={handleSubmit(onSubmit as never)} disabled={creating || updating} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {(creating || updating) && <LoadingSpinner size="sm" />}
              {editEntity ? 'Update' : 'Create'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Legal Name" error={errors.name} required className="col-span-2">
            <Input error={!!errors.name} {...register('name')} />
          </FormField>
          <FormField label="Country" error={errors.country} required>
            <Input error={!!errors.country} {...register('country')} />
          </FormField>
          <FormField label="RUC / EIN" error={errors.ruc_ein} required>
            <Input error={!!errors.ruc_ein} {...register('ruc_ein')} />
          </FormField>
          <FormField label="Address" error={errors.address} required className="col-span-2">
            <Input error={!!errors.address} {...register('address')} />
          </FormField>
          <FormField label="City" error={errors.city} required>
            <Input error={!!errors.city} {...register('city')} />
          </FormField>
          <FormField label="Active">
            <label className="flex items-center gap-2 mt-2">
              <input type="checkbox" {...register('is_active')} className="rounded" />
              <span className="text-sm text-gray-700">Mark as active entity</span>
            </label>
          </FormField>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          deleteEntity(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
        }}
        title="Delete entity"
        description={`Permanently delete ${deleteTarget?.name}? This will also delete every banking profile linked to it. If any trade still references this entity, the delete will be blocked.`}
        confirmLabel="Delete"
        isLoading={deleting}
        variant="danger"
      />
    </div>
  )
}
