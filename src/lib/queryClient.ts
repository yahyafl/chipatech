import { QueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // data stays fresh 5 min
      gcTime: 10 * 60 * 1000,     // keep in memory 10 min — instant nav between pages
      retry: 1,                    // fail fast, don't hammer Supabase 3x on error
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error) => {
        const message = error instanceof Error ? error.message : 'An error occurred'
        toast.error(message)
      },
    },
  },
})
