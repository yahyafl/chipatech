import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray'
  className?: string
}

const colorClasses = {
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
  green: 'bg-green-50 text-green-700 border-green-100',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  red: 'bg-red-50 text-red-700 border-red-100',
  purple: 'bg-purple-50 text-purple-700 border-purple-100',
  gray: 'bg-gray-50 text-gray-700 border-gray-100',
}

const iconBgClasses = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  yellow: 'bg-yellow-100 text-yellow-600',
  red: 'bg-red-100 text-red-600',
  purple: 'bg-purple-100 text-purple-600',
  gray: 'bg-gray-100 text-gray-600',
}

export function KPICard({ title, value, subtitle, icon: Icon, trend, trendValue, color = 'blue', className }: KPICardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  return (
    <div className={cn('rounded-xl border bg-white p-6 shadow-sm', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
          {trend && trendValue && (
            <div className={cn('mt-2 flex items-center gap-1 text-xs font-medium', {
              'text-green-600': trend === 'up',
              'text-red-600': trend === 'down',
              'text-gray-500': trend === 'neutral',
            })}>
              <TrendIcon className="h-3 w-3" />
              {trendValue}
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn('rounded-lg p-3', iconBgClasses[color])}>
            <Icon className="h-6 w-6" />
          </div>
        )}
      </div>
    </div>
  )
}
