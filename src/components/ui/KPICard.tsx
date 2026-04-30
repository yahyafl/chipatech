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

const iconBgClasses = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  yellow: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  purple: 'bg-purple-50 text-purple-600',
  gray: 'bg-gray-100 text-gray-600',
}

export function KPICard({ title, value, subtitle, icon: Icon, trend, trendValue, color = 'blue', className }: KPICardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  // Currency values can be 12+ characters ("$1,871,540.00"). Drop a tier
  // for those so the value never overflows or pushes the icon off-card.
  const valueStr = String(value)
  const isLongValue = valueStr.length > 10

  return (
    <div className={cn('rounded-xl border border-gray-200 bg-white p-5 shadow-sm', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-gray-500">{title}</p>
          <p
            className={cn(
              'mt-2 font-bold text-gray-900 truncate',
              isLongValue ? 'text-xl sm:text-2xl' : 'text-3xl'
            )}
            title={valueStr}
          >
            {valueStr}
          </p>
          {subtitle && <p className="mt-1 text-xs text-gray-500 truncate">{subtitle}</p>}
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
          <div className={cn('shrink-0 rounded-lg p-2.5', iconBgClasses[color])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  )
}
