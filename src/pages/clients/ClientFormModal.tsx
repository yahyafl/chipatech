import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Modal } from '@/components/ui/Modal'
import { FormField, Input, Textarea } from '@/components/ui/FormField'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { clientSchema, type ClientFormData, type Client } from '@/types'
import { useCreateClient, useUpdateClient } from '@/hooks/useClients'

interface ClientFormModalProps {
  client?: Client | null
  onClose: () => void
}

export function ClientFormModal({ client, onClose }: ClientFormModalProps) {
  const isEdit = !!client
  const { mutate: createClient, isPending: creating } = useCreateClient()
  const { mutate: updateClient, isPending: updating } = useUpdateClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema) as never,
    defaultValues: client ? { ...client, notes: client.notes ?? undefined } : {},
  })

  useEffect(() => {
    if (client) reset({ ...client, notes: client.notes ?? undefined })
  }, [client, reset])

  const onSubmit = (data: ClientFormData) => {
    if (isEdit && client) {
      updateClient({ id: client.id, data }, { onSuccess: onClose })
    } else {
      createClient(data, { onSuccess: onClose })
    }
  }

  const isPending = creating || updating

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={isEdit ? 'Edit Client' : 'Add Client'}
      size="xl"
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit(onSubmit as never)}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {isPending && <LoadingSpinner size="sm" />}
            {isEdit ? 'Update Client' : 'Create Client'}
          </button>
        </>
      }
    >
      <form className="grid grid-cols-2 gap-4">
        <FormField label="Company Name" error={errors.company_name} required className="col-span-2">
          <Input error={!!errors.company_name} {...register('company_name')} />
        </FormField>
        <FormField label="Address" error={errors.address} required className="col-span-2">
          <Input error={!!errors.address} {...register('address')} />
        </FormField>
        <FormField label="City" error={errors.city} required>
          <Input error={!!errors.city} {...register('city')} />
        </FormField>
        <FormField label="Country" error={errors.country} required>
          <Input error={!!errors.country} {...register('country')} />
        </FormField>
        <FormField label="Tax ID / RUC" error={errors.tax_id} required className="col-span-2">
          <Input error={!!errors.tax_id} {...register('tax_id')} />
        </FormField>
        <FormField label="Contact Person Name" error={errors.contact_name} required>
          <Input error={!!errors.contact_name} {...register('contact_name')} />
        </FormField>
        <FormField label="Contact Email" error={errors.contact_email} required>
          <Input type="email" error={!!errors.contact_email} {...register('contact_email')} />
        </FormField>
        <FormField label="Contact Phone" error={errors.contact_phone} required className="col-span-2">
          <Input error={!!errors.contact_phone} {...register('contact_phone')} />
        </FormField>
        <FormField label="Notes" className="col-span-2">
          <Textarea rows={3} {...register('notes')} />
        </FormField>
      </form>
    </Modal>
  )
}
