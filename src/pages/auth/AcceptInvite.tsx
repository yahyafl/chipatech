import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '@/lib/supabase'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { FormField, Input } from '@/components/ui/FormField'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { resetPasswordSchema, type ResetPasswordFormData } from '@/types'
import toast from 'react-hot-toast'
import { useEffect } from 'react'

export default function AcceptInvite() {
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({ resolver: zodResolver(resetPasswordSchema) })

  useEffect(() => {
    // Supabase puts the access_token in the URL hash after invite
    const hash = window.location.hash
    if (!hash.includes('access_token')) {
      toast.error('Invalid invite link')
    }
  }, [])

  const onSubmit = async (data: ResetPasswordFormData) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: data.password })
      if (error) throw error
      toast.success('Account set up successfully! Welcome to TradeMirror.')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set up account')
    }
  }

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accept invitation</h1>
          <p className="mt-1 text-sm text-gray-500">Set a password to activate your account</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Password" error={errors.password} required hint="At least 8 characters">
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
            {isSubmitting ? 'Setting up...' : 'Activate account'}
          </button>
        </form>
      </div>
    </AuthLayout>
  )
}
