import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMM dd, yyyy')
}

export function formatDateShort(date: string | Date): string {
  return format(new Date(date), 'MM/dd/yyyy')
}

export function formatDatetime(date: string | Date): string {
  return format(new Date(date), 'MMM dd, yyyy HH:mm')
}

export function timeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function generateTradeReference(count: number): string {
  const year = new Date().getFullYear()
  const num = String(count).padStart(3, '0')
  return `CF-${year}-${num}`
}

export function calculateFinancials(
  quantityTons: number,
  saleUnitPrice: number,
  frigoBuyTotal: number,
  shippingCost: number,
  insuranceCost: number,
  bankFees: number
) {
  const saleTotal = quantityTons * saleUnitPrice
  const totalCosts = frigoBuyTotal + shippingCost + insuranceCost + bankFees
  const netProfit = saleTotal - totalCosts
  const prepaymentAmount = saleTotal * 0.5
  const balanceAmount = saleTotal * 0.5

  return {
    saleTotal,
    totalCosts,
    netProfit,
    prepaymentAmount,
    balanceAmount,
  }
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    active: 'bg-blue-100 text-blue-800',
    advance_received: 'bg-yellow-100 text-yellow-800',
    shipped: 'bg-purple-100 text-purple-800',
    balance_received: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800',
    pending: 'bg-yellow-100 text-yellow-800',
    received: 'bg-green-100 text-green-800',
  }
  return colors[status] ?? 'bg-gray-100 text-gray-800'
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    active: 'Active',
    advance_received: 'Advance Received',
    shipped: 'Shipped',
    balance_received: 'Balance Received',
    overdue: 'Overdue',
    pending: 'Pending',
    received: 'Received',
  }
  return labels[status] ?? status
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
