import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Modal } from '@/components/ui/Modal'
import { FormField, Input } from '@/components/ui/FormField'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { contactSchema, type ContactFormData, type Contact } from '@/types'
import { useCreateContact, useUpdateContact } from '@/hooks/useContacts'

interface Props {
  contact?: Contact | null
  onClose: () => void
}

export function ContactFormModal({ contact, onClose }: Props) {
  const isEdit = !!contact
  const { mutate: createContact, isPending: creating } = useCreateContact()
  const { mutate: updateContact, isPending: updating } = useUpdateContact()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema) as never,
    defaultValues: contact ? { ...contact, role: contact.role ?? undefined } : { is_default: false },
  })

  useEffect(() => { if (contact) reset({ ...contact, role: contact.role ?? undefined }) }, [contact, reset])

  const onSubmit = (data: ContactFormData) => {
    if (isEdit && contact) {
      updateContact({ id: contact.id, data }, { onSuccess: onClose })
    } else {
      createContact(data, { onSuccess: onClose })
    }
  }

  return (
    <Modal open={true} onClose={onClose} title={isEdit ? 'Edit Contact' : 'Add Contact'}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit(onSubmit as never)} disabled={creating || updating}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {(creating || updating) && <LoadingSpinner size="sm" />}
            {isEdit ? 'Update' : 'Create'}
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
        <FormField label="Phone" error={errors.phone} required>
          <Input error={!!errors.phone} {...register('phone')} />
        </FormField>
        <FormField label="Role / Title">
          <Input placeholder="e.g. Sales Manager" {...register('role')} />
        </FormField>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="rounded" {...register('is_default')} />
          <span className="text-sm text-gray-700">Set as default contact</span>
        </label>
      </div>
    </Modal>
  )
}
