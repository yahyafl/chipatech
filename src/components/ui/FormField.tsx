import { cn } from '@/lib/utils'
import type { FieldError } from 'react-hook-form'
import React from 'react'

interface FormFieldProps {
  label: string
  error?: FieldError
  required?: boolean
  hint?: string
  children: React.ReactNode
  className?: string
}

export function FormField({ label, error, required, hint, children, className }: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error.message}</p>}
    </div>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export function Input({ error, className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors',
        'focus:outline-none focus:ring-1',
        error
          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
          : 'border-gray-200 focus:border-brand-500 focus:ring-brand-500',
        'disabled:bg-gray-50 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    />
  )
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export function Textarea({ error, className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors resize-none',
        'focus:outline-none focus:ring-1',
        error
          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
          : 'border-gray-200 focus:border-brand-500 focus:ring-brand-500',
        'disabled:bg-gray-50 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    />
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export function Select({ error, className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 transition-colors',
        'focus:outline-none focus:ring-1',
        error
          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
          : 'border-gray-200 focus:border-brand-500 focus:ring-brand-500',
        'disabled:bg-gray-50 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}
