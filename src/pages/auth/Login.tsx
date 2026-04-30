import { useEffect, useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/context/AuthContext'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { FormField, Input } from '@/components/ui/FormField'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { loginSchema, type LoginFormData } from '@/types'
import toast from 'react-hot-toast'
import { LogIn } from 'lucide-react'

export default function Login() {
  const { login, user, role } = useAuth()
  const navigate = useNavigate()
  const [slowWarning, setSlowWarning] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Recovery-token rescue: if Supabase's email link landed here instead
  // of /reset-password (e.g. Site URL mis-configured), forward to the
  // reset page with the recovery hash intact so the user can finish.
  useEffect(() => {
    const hash = window.location.hash
    const search = window.location.search
    const isRecovery =
      hash.includes('type=recovery') ||
      hash.includes('access_token') ||
      search.includes('code=') // PKCE flow uses ?code= in query params
    if (isRecovery) {
      navigate(`/reset-password${search}${hash}`, { replace: true })
    }
  }, [navigate])

  // Redirect already-authenticated users (after the recovery check above)
  useEffect(() => {
    if (user && role) {
      if (role === 'partner') navigate('/partner', { replace: true })
      else if (role === 'internal') navigate('/internal/trades', { replace: true })
      else navigate('/dashboard', { replace: true })
    }
  }, [user, role, navigate])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginFormData) => {
    setSlowWarning(false)
    setAuthError(null)
    // Show a "taking longer than usual" hint after 4 seconds
    slowTimer.current = setTimeout(() => setSlowWarning(true), 4000)
    try {
      await login(data.email, data.password)
      // Redirect handled by useEffect above once loadUser sets user+role
    } catch (err) {
      // Generic message — don't leak whether the email exists
      const raw = err instanceof Error ? err.message : ''
      const friendly = /invalid login credentials|invalid email|invalid password/i.test(raw)
        ? 'Invalid email or password'
        : raw || 'Sign-in failed. Please try again.'
      setAuthError(friendly)
      toast.error(friendly)
    } finally {
      if (slowTimer.current) clearTimeout(slowTimer.current)
      setSlowWarning(false)
    }
  }

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to your TradeMirror account</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {authError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {authError}
            </div>
          )}
          <FormField label="Email address" error={errors.email} required>
            <Input
              type="email"
              placeholder="you@chipafarm.com"
              error={!!errors.email}
              autoComplete="email"
              {...register('email')}
            />
          </FormField>
          <FormField label="Password" error={errors.password} required>
            <Input
              type="password"
              placeholder="••••••••"
              error={!!errors.password}
              autoComplete="current-password"
              {...register('password')}
            />
          </FormField>
          <div className="flex items-center justify-end">
            <Link to="/forgot-password" className="text-sm text-brand-600 hover:text-brand-700 transition-colors">
              Forgot password?
            </Link>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? <LoadingSpinner size="sm" /> : <LogIn className="h-4 w-4" />}
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
          {slowWarning && (
            <p className="text-center text-xs text-amber-600 animate-pulse">
              Taking longer than usual — your database may be waking up. Please wait...
            </p>
          )}
        </form>
      </div>
    </AuthLayout>
  )
}
