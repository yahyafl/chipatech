import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { readCache, writeCache } from '@/lib/localCache'
import { DEFAULT_CLIENTS } from '@/lib/defaultSetupData'
import toast from 'react-hot-toast'
import type { Client, ClientFormData } from '@/types'

const CACHE_TTL = 5 * 60 * 1000

export function useClients(search?: string) {
  const cacheKey = search ? `tm_clients_${search}` : 'tm_clients'
  const cached = readCache<Client[]>(cacheKey, CACHE_TTL)
  return useQuery({
    queryKey: ['clients', search],
    queryFn: async ({ signal }) => {
      let query = supabase.from('clients').select('*').order('company_name').abortSignal(signal)
      if (search) query = query.ilike('company_name', `%${search}%`)
      const { data, error } = await query
      if (error) throw error
      writeCache(cacheKey, data)
      return data as Client[]
    },
    initialData: cached ?? (search ? undefined : DEFAULT_CLIENTS),
    initialDataUpdatedAt: cached ? Date.now() - 1000 : (search ? undefined : 0),
    staleTime: CACHE_TTL,
  })
}

export function useClient(id: string | undefined) {
  const cached = id ? readCache<Client>(`tm_client_${id}`, CACHE_TTL) : null
  return useQuery({
    queryKey: ['clients', id],
    queryFn: async ({ signal }) => {
      if (!id) return null
      const { data, error } = await supabase.from('clients').select('*').eq('id', id).abortSignal(signal).single()
      if (error) throw error
      writeCache(`tm_client_${id}`, data)
      return data as Client
    },
    enabled: !!id,
    initialData: cached ?? undefined,
    initialDataUpdatedAt: cached ? Date.now() - 1000 : undefined,
    staleTime: CACHE_TTL,
  })
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: ClientFormData) => {
      const { data: created, error } = await supabase.from('clients').insert(data).select().single()
      if (error) throw error
      return created as Client
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client created successfully')
    },
  })
}

export function useUpdateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ClientFormData> }) => {
      const { data: updated, error } = await supabase.from('clients').update(data).eq('id', id).select().single()
      if (error) throw error
      return updated as Client
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['clients', id] })
      toast.success('Client updated successfully')
    },
  })
}

export function useDeleteClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clients').delete().eq('id', id)
      if (error) {
        // trades.client_id has no ON DELETE CASCADE, so a client with any
        // trades raises a Postgres FK violation. Translate to a useful
        // toast instead of leaking the raw error.
        if (/foreign key|violates|referenced|23503/i.test(error.message)) {
          throw new Error('Cannot delete: this client is referenced by one or more trades. Reassign or delete those trades first.')
        }
        throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
