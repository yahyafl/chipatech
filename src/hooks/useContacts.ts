import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { readCache, writeCache } from '@/lib/localCache'
import { DEFAULT_CONTACTS } from '@/lib/defaultSetupData'
import toast from 'react-hot-toast'
import type { Contact, ContactFormData } from '@/types'

const CACHE_TTL = 5 * 60 * 1000

export function useContacts() {
  const cached = readCache<Contact[]>('tm_contacts', CACHE_TTL)
  return useQuery({
    queryKey: ['contacts'],
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from('contacts').select('*')
        .order('is_default', { ascending: false }).order('full_name')
        .abortSignal(signal)
      if (error) throw error
      writeCache('tm_contacts', data)
      return data as Contact[]
    },
    initialData: cached ?? DEFAULT_CONTACTS,
    initialDataUpdatedAt: cached ? Date.now() - 1000 : 0,
    staleTime: CACHE_TTL,
  })
}

export function useCreateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: ContactFormData) => {
      // If this contact is being created as default, unset any other default
      // first so the "single default" invariant from PRD §6.2 holds.
      if (data.is_default) {
        await supabase.from('contacts').update({ is_default: false }).eq('is_default', true)
      }
      const { data: created, error } = await supabase.from('contacts').insert(data).select().single()
      if (error) throw error
      return created as Contact
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      toast.success('Contact created')
    },
  })
}

export function useUpdateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ContactFormData> }) => {
      // Same single-default invariant as create.
      if (data.is_default) {
        await supabase.from('contacts').update({ is_default: false }).eq('is_default', true).neq('id', id)
      }
      const { data: updated, error } = await supabase.from('contacts').update(data).eq('id', id).select().single()
      if (error) throw error
      return updated as Contact
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      toast.success('Contact updated')
    },
  })
}

export function useDeleteContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contacts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      toast.success('Contact deleted')
    },
  })
}

export function useSetDefaultContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('contacts').update({ is_default: false }).neq('id', id)
      const { error } = await supabase.from('contacts').update({ is_default: true }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      toast.success('Default contact updated')
    },
  })
}
