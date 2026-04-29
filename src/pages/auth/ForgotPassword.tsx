import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/context/AuthContext'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { FormField, Input } from '@/components/ui/FormField'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { forgotPasswordSchema, type ForgotPasswordFormData } from '@/types'
import toast from 'react-hot-toast'
import { useState } from 'react'
import { Mail, ArrowLeft } from 'lucide-react'

export default function ForgotPassword() {
  const { forgotPassword } = useAuth()
  const [sent, setSent] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<ForgotPasswordFormData>({ resolver: zodResolver(forgotPasswordSchema) })

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      await forgotPassword(data.email)
      setSent(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reset email')
    }
  }

  return (
    <AuthLayout>
      {sent ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Mail className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Check your email</h1>
          <p className="text-sm text-gray-500">
            We sent a password reset link to <strong>{getValues('email')}</strong>
          </p>
          <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-brand-600 hover:text-brand-700">
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reset password</h1>
            <p className="mt-1 text-sm text-gray-500">Enter your email to receive a reset link</p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField label="Email address" error={errors.email} required>
              <Input type="email" placeholder="you@chipafarm.com" error={!!errors.email} {...register('email')} />
            </FormField>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? <LoadingSpinner size="sm" /> : null}
              {isSubmitting ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
          <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </div>
      )}
    </AuthLayout>
  )
}
