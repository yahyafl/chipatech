import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  label?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function LoadingSpinner({ label, size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  }

  return (
    <div className={cn('flex flex-col items-center justify-center gap-2', className)}>
      <div
        className={cn(
          'animate-spin rounded-full border-2 border-gray-200 border-t-brand-600',
          sizeClasses[size]
        )}
      />
      {label && <p className="text-sm text-gray-500">{label}</p>}
    </div>
  )
}
