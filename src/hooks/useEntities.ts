import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { readCache, writeCache } from '@/lib/localCache'
import { DEFAULT_ENTITIES } from '@/lib/defaultSetupData'
import toast from 'react-hot-toast'
import type { Entity, EntityFormData } from '@/types'

const CACHE_TTL = 5 * 60 * 1000

export function useEntities() {
  const cached = readCache<Entity[]>('tm_entities', CACHE_TTL)
  return useQuery({
    queryKey: ['entities'],
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from('entities').select('*').order('name')
        .abortSignal(signal)
      if (error) throw error
      writeCache('tm_entities', data)
      return data as Entity[]
    },
    initialData: cached ?? DEFAULT_ENTITIES,
    initialDataUpdatedAt: cached ? Date.now() - 1000 : 0,
    staleTime: CACHE_TTL,
  })
}

export function useEntity(id: string | undefined) {
  const cached = id ? readCache<Entity>(`tm_entity_${id}`, CACHE_TTL) : null
  return useQuery({
    queryKey: ['entities', id],
    queryFn: async ({ signal }) => {
      if (!id) return null
      const { data, error } = await supabase.from('entities').select('*').eq('id', id).abortSignal(signal).single()
      if (error) throw error
      writeCache(`tm_entity_${id}`, data)
      return data as Entity
    },
    enabled: !!id,
    initialData: cached ?? undefined,
    initialDataUpdatedAt: cached ? Date.now() - 1000 : undefined,
    staleTime: CACHE_TTL,
  })
}

export function useCreateEntity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: EntityFormData) => {
      const { data: created, error } = await supabase.from('entities').insert(data).select().single()
      if (error) throw error
      return created as Entity
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entities'] })
      toast.success('Entity created')
    },
  })
}

export function useUpdateEntity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EntityFormData> }) => {
      const { data: updated, error } = await supabase.from('entities').update(data).eq('id', id).select().single()
      if (error) throw error
      return updated as Entity
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entities'] })
      toast.success('Entity updated')
    },
  })
}
