import { useMemo, useState } from 'react'
import { Download, Printer, AlertTriangle } from 'lucide-react'
import { useTrades } from '@/hooks/useTrades'
import { formatCurrency, formatDate, downloadBlob } from '@/lib/utils'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import type { Trade } from '@/types'

const NOT_FILING_NOTICE =
  'NOTICE: This export is a data extract for CPA review only. It does NOT constitute a tax filing.'

export default function TaxExport() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const { data: trades, isLoading } = useTrades({
    dateFrom: `${year}-01-01`,
    dateTo: `${year}-12-31`,
  })

  // Per PRD §12.2: trades must be flagged by entity period (E.A.S. vs LLC)
  // so the CPA can split them onto the right IRS form (5472 / 1065). We
  // group rows by entity name and emit a separate section per group.
  const groupedByEntity = useMemo(() => {
    const groups = new Map<string, Trade[]>()
    for (const t of trades ?? []) {
      const key = t.entity?.name ?? 'Unassigned Entity'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(t)
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [trades])

  const exportCSV = () => {
    if (!trades?.length) return
    const lines: string[] = [
      `# ${NOT_FILING_NOTICE}`,
      `# Tax Year: ${year}`,
      '',
    ]
    const headers = [
      'Trade ID', 'Date', 'Client', 'Client Country', 'Entity',
      'Frigo Price', 'Sale Total', 'Shipping', 'Insurance', 'Bank Fees',
      'Net Profit', 'Income Classification',
    ]
    for (const [entityName, group] of groupedByEntity) {
      lines.push(`# Entity Period: ${entityName}`)
      lines.push(headers.map(quote).join(','))
      let totalFrigo = 0, totalSale = 0, totalShip = 0, totalIns = 0, totalFees = 0, totalNet = 0
      for (const t of group) {
        totalFrigo += Number(t.frigo_total) || 0
        totalSale += Number(t.sale_total) || 0
        totalShip += Number(t.shipping_cost) || 0
        totalIns += Number(t.insurance_cost) || 0
        totalFees += Number(t.bank_fees) || 0
        totalNet += Number(t.net_profit) || 0
        lines.push([
          t.trade_reference,
          t.contract_date,
          t.client?.company_name ?? '',
          t.client?.country ?? '',
          entityName,
          t.frigo_total,
          t.sale_total,
          t.shipping_cost,
          t.insurance_cost,
          t.bank_fees,
          t.net_profit,
          'Foreign Sourced Income (Non-US)',
        ].map(quote).join(','))
      }
      lines.push([
        'SUBTOTAL', '', '', '', entityName,
        totalFrigo, totalSale, totalShip, totalIns, totalFees, totalNet, '',
      ].map(quote).join(','))
      lines.push('')
    }
    downloadBlob(new Blob([lines.join('\n')], { type: 'text/csv' }), `TradeMirror-Tax-${year}.csv`)
  }

  // PDF export uses the browser's native Print → Save as PDF. Avoids
  // pulling pdf-lib into this bundle; gives the CPA a printable layout
  // that matches the on-screen grouping exactly.
  const exportPDF = () => window.print()

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .tax-section { page-break-inside: avoid; }
        }
      `}</style>

      <div className="flex items-center justify-between no-print">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Tax Readiness Export</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Annual data export for CPA review. Trades grouped by entity period for IRS Form 5472 / 1065 prep.
          </p>
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
            className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
          <button
            onClick={exportPDF}
            disabled={isLoading || !trades?.length}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            <Printer className="h-4 w-4" />
            PDF (Print)
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-semibold">{NOT_FILING_NOTICE}</p>
          <p className="mt-1">
            All income shown is classified as <strong>Foreign Sourced (Non-US)</strong>. Use this report
            to populate IRS Form 5472 (E.A.S. period) or Form 1065 (LLC period) — not as a substitute for them.
          </p>
        </div>
      </div>

      {isLoading ? <LoadingSpinner /> : groupedByEntity.length === 0 ? (
        <div className="rounded-xl bg-white border border-gray-200 p-8 text-center text-gray-400">
          No trades in {year}
        </div>
      ) : (
        groupedByEntity.map(([entityName, group]) => (
          <EntitySection key={entityName} entityName={entityName} trades={group} year={year} />
        ))
      )}
    </div>
  )
}

function quote(value: unknown): string {
  const s = String(value ?? '')
  return `"${s.replace(/"/g, '""')}"`
}

interface EntitySectionProps {
  entityName: string
  trades: Trade[]
  year: number
}

function EntitySection({ entityName, trades, year }: EntitySectionProps) {
  const totals = trades.reduce(
    (acc, t) => ({
      frigo: acc.frigo + (Number(t.frigo_total) || 0),
      sale: acc.sale + (Number(t.sale_total) || 0),
      ship: acc.ship + (Number(t.shipping_cost) || 0),
      ins: acc.ins + (Number(t.insurance_cost) || 0),
      fees: acc.fees + (Number(t.bank_fees) || 0),
      net: acc.net + (Number(t.net_profit) || 0),
    }),
    { frigo: 0, sale: 0, ship: 0, ins: 0, fees: 0, net: 0 },
  )

  return (
    <div className="tax-section rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
      <div className="border-b border-gray-100 px-6 py-3 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">
          Entity Period: <span className="text-brand-700">{entityName}</span>
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          {trades.length} trade{trades.length === 1 ? '' : 's'} · Tax year {year}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Trade ID', 'Date', 'Client', 'Country', 'Frigo Price', 'Sale Total', 'Shipping', 'Insurance', 'Bank Fees', 'Net Profit'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {trades.map((t) => (
              <tr key={t.id}>
                <td className="px-3 py-2 font-mono font-semibold text-brand-600">{t.trade_reference}</td>
                <td className="px-3 py-2 text-gray-600">{formatDate(t.contract_date)}</td>
                <td className="px-3 py-2">{t.client?.company_name}</td>
                <td className="px-3 py-2 text-xs">{t.client?.country}</td>
                <td className="px-3 py-2">{formatCurrency(t.frigo_total)}</td>
                <td className="px-3 py-2 font-medium">{formatCurrency(t.sale_total)}</td>
                <td className="px-3 py-2 text-xs">{formatCurrency(t.shipping_cost)}</td>
                <td className="px-3 py-2 text-xs">{formatCurrency(t.insurance_cost)}</td>
                <td className="px-3 py-2 text-xs">{formatCurrency(t.bank_fees)}</td>
                <td className={`px-3 py-2 font-semibold ${t.net_profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {formatCurrency(t.net_profit)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-semibold">
            <tr>
              <td className="px-3 py-2 text-xs uppercase tracking-wider text-gray-700" colSpan={4}>
                Subtotal — {entityName}
              </td>
              <td className="px-3 py-2">{formatCurrency(totals.frigo)}</td>
              <td className="px-3 py-2">{formatCurrency(totals.sale)}</td>
              <td className="px-3 py-2 text-xs">{formatCurrency(totals.ship)}</td>
              <td className="px-3 py-2 text-xs">{formatCurrency(totals.ins)}</td>
              <td className="px-3 py-2 text-xs">{formatCurrency(totals.fees)}</td>
              <td className={`px-3 py-2 ${totals.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatCurrency(totals.net)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
