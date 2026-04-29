import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import type { UserRole } from '@/types'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

interface RoleGuardProps {
  allowedRoles: UserRole[]
  redirectTo?: string
  children: React.ReactNode
}

export function RoleGuard({ allowedRoles, redirectTo = '/dashboard', children }: RoleGuardProps) {
  const { role, isLoading } = useAuth()

  // If role is known, evaluate immediately — don't wait on isLoading
  if (!role && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <LoadingSpinner label="Loading..." />
      </div>
    )
  }

  if (!role || !allowedRoles.includes(role)) {
    // Redirect to role-appropriate page
    if (role === 'partner') return <Navigate to="/partner" replace />
    if (role === 'internal') return <Navigate to="/internal/trades" replace />
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}
