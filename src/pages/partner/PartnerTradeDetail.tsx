import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Download, CheckCircle, AlertTriangle } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useTrade } from '@/hooks/useTrades'
import { useDocuments, useDownloadDocument } from '@/hooks/useDocuments'
import { formatCurrency, formatDate, formatDatetime } from '@/lib/utils'

export default function PartnerTradeDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: trade, isLoading } = useTrade(id)
  const { data: documents } = useDocuments(id)
  const { mutate: downloadDoc } = useDownloadDocument()

  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>
  if (!trade) return <div className="py-20 text-center text-gray-500">Trade not found</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/partner" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{trade.trade_reference}</h1>
          <p className="text-sm text-gray-500">{trade.client?.company_name} — {formatDate(trade.contract_date)}</p>
        </div>
        <StatusBadge status={trade.trade_status} className="ml-auto" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Financial Breakdown */}
          <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Financial Breakdown</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-600">Investment (Frigo Purchase)</span>
                <span className="font-medium">{formatCurrency(trade.frigo_total)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-600">+ Shipping Cost</span>
                <span className="font-medium">{formatCurrency(trade.shipping_cost)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-600">+ Insurance Cost</span>
                <span className="font-medium">{formatCurrency(trade.insurance_cost)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-600">+ Bank Fees</span>
                <span className="font-medium">{formatCurrency(trade.bank_fees)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-200">
                <span className="font-medium text-gray-700">Total Costs</span>
                <span className="font-semibold">{formatCurrency(trade.total_costs)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-600">Sale Total</span>
                <span className="font-medium">{formatCurrency(trade.sale_total)}</span>
              </div>
              <div className="flex justify-between py-2 mt-1 rounded-lg bg-gray-50 px-3">
                <span className="font-semibold text-gray-800">Net Profit</span>
                <span className={`text-xl font-bold ${trade.net_profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {formatCurrency(trade.net_profit)}
                </span>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Documents</h2>
            {documents?.length === 0 ? (
              <p className="text-sm text-gray-500">No documents uploaded yet</p>
            ) : (
              <div className="space-y-2">
                {documents?.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{doc.file_name}</p>
                      <p className="text-xs text-gray-500 capitalize">{doc.document_type.replace('_', ' ')} · {formatDatetime(doc.uploaded_at)}</p>
                    </div>
                    <button
                      onClick={() => downloadDoc({ storagePath: doc.storage_path, fileName: doc.file_name })}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Download className="h-3.5 w-3.5" />Download
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Milestones */}
        <div className="space-y-4">
          <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-3">50% Advance</h3>
            <StatusBadge status={trade.advance_status} />
            <div className="mt-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-semibold">{formatCurrency(trade.sale_total * 0.5)}</span></div>
              {trade.advance_received_at && <p className="flex items-center gap-1 text-green-700 text-xs mt-2"><CheckCircle className="h-3.5 w-3.5" />Received {formatDatetime(trade.advance_received_at)}</p>}
              {trade.advance_status === 'overdue' && <p className="flex items-center gap-1 text-red-700 text-xs mt-2"><AlertTriangle className="h-3.5 w-3.5" />Overdue</p>}
            </div>
          </div>
          <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-3">50% Balance</h3>
            <StatusBadge status={trade.balance_status} />
            <div className="mt-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-semibold">{formatCurrency(trade.sale_total * 0.5)}</span></div>
              {trade.balance_received_at && <p className="flex items-center gap-1 text-green-700 text-xs mt-2"><CheckCircle className="h-3.5 w-3.5" />Received {formatDatetime(trade.balance_received_at)}</p>}
              {trade.balance_status === 'overdue' && <p className="flex items-center gap-1 text-red-700 text-xs mt-2"><AlertTriangle className="h-3.5 w-3.5" />Overdue</p>}
            </div>
          </div>
          <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Cargo</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Quantity</span><span className="font-medium">{trade.quantity_tons} tons</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Destination</span><span className="font-medium">Egypt</span></div>
              <div><p className="text-gray-500">Product</p><p className="text-xs mt-0.5">{trade.product_description}</p></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
