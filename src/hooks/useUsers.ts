import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { readCache, writeCache } from '@/lib/localCache'
import toast from 'react-hot-toast'
import type { User, UserRole } from '@/types'

const CACHE_TTL = 5 * 60 * 1000

export function useUsers() {
  const cached = readCache<User[]>('tm_users', CACHE_TTL)
  return useQuery({
    queryKey: ['users'],
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false }).abortSignal(signal)
      if (error) throw error
      writeCache('tm_users', data)
      return data as User[]
    },
    initialData: cached ?? undefined,
    initialDataUpdatedAt: cached ? Date.now() - 1000 : undefined,
    staleTime: CACHE_TTL,
  })
}

export function useInviteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ email, full_name, role }: { email: string; full_name: string; role: UserRole }) => {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email, full_name, role },
      })
      if (error) throw new Error(error.message ?? 'Invite failed')
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('Invitation email sent')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useUpdateUserRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRole }) => {
      const { error } = await supabase.from('users').update({ role }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('User role updated')
    },
  })
}

export function useDeactivateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('users').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('User deactivated')
    },
  })
}

export function useReactivateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('users').update({ is_active: true }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('User reactivated')
    },
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (user_id: string) => {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { user_id },
      })
      if (error) throw new Error(error.message ?? 'Delete failed')
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('User deleted')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}
