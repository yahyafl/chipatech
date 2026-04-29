import { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LoadingSpinner } from './LoadingSpinner'
import { EmptyState } from './EmptyState'
import { Pagination } from './Pagination'
import { FileX } from 'lucide-react'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  className?: string
  headerClassName?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  isLoading?: boolean
  emptyMessage?: string
  onRowClick?: (row: T) => void
  totalCount?: number
  page?: number
  pageSize?: number
  onPageChange?: (page: number) => void
  keyExtractor?: (row: T) => string
}

type SortDirection = 'asc' | 'desc' | null

export function DataTable<T extends object>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No data found',
  onRowClick,
  totalCount,
  page = 1,
  pageSize = 20,
  onPageChange,
  keyExtractor,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : sortDir === 'desc' ? null : 'asc')
      if (sortDir === 'desc') setSortKey(null)
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedData = [...data].sort((a, b) => {
    if (!sortKey || !sortDir) return 0
    const aVal = (a as Record<string, unknown>)[sortKey]
    const bVal = (b as Record<string, unknown>)[sortKey]
    if (aVal === bVal) return 0
    const cmp = (aVal as string | number) < (bVal as string | number) ? -1 : 1
    return sortDir === 'asc' ? cmp : -cmp
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner label="Loading..." />
      </div>
    )
  }

  if (data.length === 0) {
    return <EmptyState icon={FileX} title={emptyMessage} />
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600',
                    col.sortable && 'cursor-pointer select-none hover:bg-gray-100',
                    col.headerClassName
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <span className="text-gray-400">
                        {sortKey === col.key ? (
                          sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronsUpDown className="h-3 w-3" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {sortedData.map((row, idx) => (
              <tr
                key={keyExtractor ? keyExtractor(row) : idx}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-gray-50'
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn('px-4 py-3 text-sm text-gray-700 whitespace-nowrap', col.className)}
                  >
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalCount !== undefined && onPageChange && (
        <Pagination
          currentPage={page}
          totalItems={totalCount}
          pageSize={pageSize}
          onPageChange={onPageChange}
        />
      )}
    </div>
  )
}
