import { useState } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'
import { useTrades } from '@/hooks/useTrades'
import { formatCurrency, formatDate, downloadBlob } from '@/lib/utils'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

export default function TaxExport() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const { data: trades, isLoading } = useTrades({
    dateFrom: `${year}-01-01`,
    dateTo: `${year}-12-31`,
  })

  const exportCSV = () => {
    if (!trades) return
    const headers = ['Trade ID', 'Date', 'Client', 'Client Country', 'Entity', 'Frigo Price', 'Sale Total', 'Shipping', 'Insurance', 'Bank Fees', 'Net Profit', 'Income Classification']
    const rows = trades.map((t) => [
      t.trade_reference,
      t.contract_date,
      t.client?.company_name ?? '',
      t.client?.country ?? '',
      t.entity?.name ?? '',
      t.frigo_total,
      t.sale_total,
      t.shipping_cost,
      t.insurance_cost,
      t.bank_fees,
      t.net_profit,
      'Foreign Sourced Income (Non-US)',
    ])
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    downloadBlob(new Blob([csv], { type: 'text/csv' }), `TradeMirror-Tax-${year}.csv`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Tax Readiness Export</h2>
          <p className="text-sm text-gray-500 mt-0.5">Annual data export for CPA use. All income classified as Foreign Sourced (Non-US).</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={exportCSV}
            disabled={isLoading || !trades?.length}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Trade ID', 'Date', 'Client', 'Entity', 'Frigo Price', 'Sale Total', 'Net Profit', 'Classification'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(trades ?? []).map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-semibold text-brand-600">{t.trade_reference}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(t.contract_date)}</td>
                  <td className="px-4 py-3">{t.client?.company_name}</td>
                  <td className="px-4 py-3 text-xs">{t.entity?.name}</td>
                  <td className="px-4 py-3">{formatCurrency(t.frigo_total)}</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(t.sale_total)}</td>
                  <td className={`px-4 py-3 font-semibold ${t.net_profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(t.net_profit)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">Foreign Sourced (Non-US)</td>
                </tr>
              ))}
              {!trades?.length && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No trades in {year}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
