import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { FormField, Input, Select } from '@/components/ui/FormField'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { useEntities } from '@/hooks/useEntities'
import { useBankProfiles, useCreateBankProfile, useUpdateBankProfile, useDeleteBankProfile } from '@/hooks/useBankProfiles'
import { bankProfileSchema, type BankProfileFormData, type BankProfile } from '@/types'
import { Landmark } from 'lucide-react'

export default function BankingProfiles() {
  const { data: entities } = useEntities()
  const { data: profiles, isLoading } = useBankProfiles()
  const { mutate: createProfile, isPending: creating } = useCreateBankProfile()
  const { mutate: updateProfile, isPending: updating } = useUpdateBankProfile()
  const { mutate: deleteProfile, isPending: deleting } = useDeleteBankProfile()
  const [showCreate, setShowCreate] = useState(false)
  const [editProfile, setEditProfile] = useState<BankProfile | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<BankProfileFormData>({
    resolver: zodResolver(bankProfileSchema) as never,
    defaultValues: { field_71a: 'OUR', is_default: false },
  })

  const onSubmit = (data: BankProfileFormData) => {
    if (editProfile) {
      updateProfile({ id: editProfile.id, data }, { onSuccess: () => { setEditProfile(null); reset() } })
    } else {
      createProfile(data, { onSuccess: () => { setShowCreate(false); reset() } })
    }
  }

  // Group by entity
  const grouped = (entities ?? []).map((entity) => ({
    entity,
    profiles: (profiles ?? []).filter((p) => p.entity_id === entity.id),
  }))

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Banking Profiles</h2>
        <button onClick={() => { setShowCreate(true); reset({ field_71a: 'OUR', is_default: false }) }} className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" />Add Profile
        </button>
      </div>

      {grouped.map(({ entity, profiles: entityProfiles }) => (
        <div key={entity.id} className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
          <h3 className="font-semibold text-gray-900 mb-3">{entity.name}</h3>
          {entityProfiles.length === 0 ? (
            <EmptyState icon={Landmark} title="No banking profiles" description="Add a banking profile for this entity" />
          ) : (
            <div className="space-y-2">
              {entityProfiles.map((profile) => (
                <div key={profile.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{profile.profile_name} {profile.is_default && <span className="text-xs text-brand-600">(Default)</span>}</p>
                    <p className="text-xs text-gray-500">{profile.bank_name} · {profile.bank_swift} · {profile.account_number}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditProfile(profile); reset({ ...profile, ara_number: profile.ara_number ?? undefined }) }} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleteId(profile.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <Modal open={showCreate || !!editProfile} onClose={() => { setShowCreate(false); setEditProfile(null); reset() }}
        title={editProfile ? 'Edit Banking Profile' : 'Add Banking Profile'} size="lg"
        footer={
          <>
            <button onClick={() => { setShowCreate(false); setEditProfile(null); reset() }} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSubmit(onSubmit as never)} disabled={creating || updating} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {(creating || updating) && <LoadingSpinner size="sm" />}
              {editProfile ? 'Update' : 'Create'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Entity" error={errors.entity_id} required className="col-span-2">
            <Select error={!!errors.entity_id} {...register('entity_id')}>
              <option value="">Select entity...</option>
              {entities?.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Profile Name" error={errors.profile_name} required className="col-span-2">
            <Input error={!!errors.profile_name} {...register('profile_name')} />
          </FormField>
          <FormField label="Beneficiary Name" error={errors.beneficiary_name} required>
            <Input error={!!errors.beneficiary_name} {...register('beneficiary_name')} />
          </FormField>
          <FormField label="Beneficiary Address" error={errors.beneficiary_address} required>
            <Input error={!!errors.beneficiary_address} {...register('beneficiary_address')} />
          </FormField>
          <FormField label="Intermediary Bank" error={errors.intermediary_bank_name} required>
            <Input error={!!errors.intermediary_bank_name} {...register('intermediary_bank_name')} />
          </FormField>
          <FormField label="Intermediary SWIFT" error={errors.intermediary_bank_swift} required>
            <Input error={!!errors.intermediary_bank_swift} {...register('intermediary_bank_swift')} />
          </FormField>
          <FormField label="Bank Name" error={errors.bank_name} required>
            <Input error={!!errors.bank_name} {...register('bank_name')} />
          </FormField>
          <FormField label="Bank SWIFT" error={errors.bank_swift} required>
            <Input error={!!errors.bank_swift} {...register('bank_swift')} />
          </FormField>
          <FormField label="Account Number" error={errors.account_number} required className="col-span-2">
            <Input error={!!errors.account_number} {...register('account_number')} />
          </FormField>
          <FormField label="ARA Number">
            <Input {...register('ara_number')} />
          </FormField>
          <FormField label="Field 71A">
            <Input {...register('field_71a')} readOnly className="bg-gray-50" />
          </FormField>
          <FormField label="" className="col-span-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" {...register('is_default')} className="rounded" />
              <span className="text-sm text-gray-700">Set as default for entity</span>
            </label>
          </FormField>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteProfile(deleteId, { onSuccess: () => setDeleteId(null) }) }}
        title="Delete banking profile"
        description="Are you sure you want to delete this banking profile?"
        confirmLabel="Delete"
        isLoading={deleting}
      />
    </div>
  )
}
