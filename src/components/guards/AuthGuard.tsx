import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  // If we already have a user (from cache or resolved auth), render immediately.
  // Never block a cached user on the loading state.
  if (user) return <>{children}</>

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-xl bg-brand-600 p-3">
            <span className="text-white font-bold text-lg px-1">TM</span>
          </div>
          <LoadingSpinner label="Resuming session..." />
        </div>
      </div>
    )
  }

  return <Navigate to="/login" state={{ from: location }} replace />
}
