import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { readCache, writeCache } from '@/lib/localCache'
import { DEFAULT_BANK_PROFILES } from '@/lib/defaultSetupData'
import toast from 'react-hot-toast'
import type { BankProfile, BankProfileFormData } from '@/types'

const CACHE_TTL = 5 * 60 * 1000

export function useBankProfiles(entityId?: string) {
  const cacheKey = entityId ? `tm_bank_profiles_${entityId}` : 'tm_bank_profiles'
  const cached = readCache<BankProfile[]>(cacheKey, CACHE_TTL)
  const defaultData = entityId
    ? DEFAULT_BANK_PROFILES.filter(b => b.entity_id === entityId)
    : DEFAULT_BANK_PROFILES
  return useQuery({
    queryKey: ['bank_profiles', entityId],
    queryFn: async ({ signal }) => {
      let query = supabase.from('bank_profiles').select('*').order('is_default', { ascending: false }).order('profile_name').abortSignal(signal)
      if (entityId) query = query.eq('entity_id', entityId)
      const { data, error } = await query
      if (error) throw error
      writeCache(cacheKey, data)
      return data as BankProfile[]
    },
    initialData: cached ?? defaultData,
    initialDataUpdatedAt: cached ? Date.now() - 1000 : 0,
    staleTime: CACHE_TTL,
  })
}

export function useCreateBankProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: BankProfileFormData) => {
      const { data: created, error } = await supabase.from('bank_profiles').insert(data).select().single()
      if (error) throw error
      return created as BankProfile
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank_profiles'] })
      toast.success('Banking profile created')
    },
  })
}

export function useUpdateBankProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<BankProfileFormData> }) => {
      const { data: updated, error } = await supabase.from('bank_profiles').update(data).eq('id', id).select().single()
      if (error) throw error
      return updated as BankProfile
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank_profiles'] })
      toast.success('Banking profile updated')
    },
  })
}

export function useDeleteBankProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bank_profiles').delete().eq('id', id)
      if (error) {
        if (/foreign key|violates|referenced|23503/i.test(error.message)) {
          throw new Error('Cannot delete: this banking profile is referenced by one or more trades. Reassign or delete those trades first.')
        }
        throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank_profiles'] })
      toast.success('Banking profile deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
