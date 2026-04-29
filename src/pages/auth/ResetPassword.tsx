import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { FormField, Input } from '@/components/ui/FormField'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { resetPasswordSchema, type ResetPasswordFormData } from '@/types'
import toast from 'react-hot-toast'

export default function ResetPassword() {
  const { resetPassword, logout } = useAuth()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({ resolver: zodResolver(resetPasswordSchema) })

  // If there's no recovery token in the URL this page shouldn't be accessible
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('type=recovery') && !hash.includes('access_token')) {
      // Also listen via onAuthStateChange in case token arrives slightly late
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event !== 'PASSWORD_RECOVERY') navigate('/login', { replace: true })
      })
      return () => subscription.unsubscribe()
    }
  }, [navigate])

  const onSubmit = async (data: ResetPasswordFormData) => {
    try {
      await resetPassword(data.password)
      toast.success('Password updated successfully. Please sign in.')
      // Sign out to clear the recovery session, then send to login
      await logout()
      navigate('/login', { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update password')
    }
  }

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Set new password</h1>
          <p className="mt-1 text-sm text-gray-500">Choose a strong password for your account</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="New password" error={errors.password} required>
            <Input type="password" placeholder="••••••••" error={!!errors.password} {...register('password')} />
          </FormField>
          <FormField label="Confirm password" error={errors.confirmPassword} required>
            <Input type="password" placeholder="••••••••" error={!!errors.confirmPassword} {...register('confirmPassword')} />
          </FormField>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? <LoadingSpinner size="sm" /> : null}
            {isSubmitting ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </div>
    </AuthLayout>
  )
}
