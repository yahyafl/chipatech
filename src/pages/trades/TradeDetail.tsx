import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { FolderOpen, CheckCircle, Clock, AlertTriangle, Send } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useTrade, useMarkMilestoneReceived, useUpdateTradeStatus, useSendContractToClient } from '@/hooks/useTrades'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency, formatDate, formatDatetime } from '@/lib/utils'
import type { TradeStatus } from '@/types'

const STATUS_TRANSITIONS: { from: TradeStatus[]; to: TradeStatus; label: string }[] = [
  { from: ['draft'], to: 'active', label: 'Mark as Active (Sent to Client)' },
  { from: ['active', 'advance_received'], to: 'shipped', label: 'Mark as Shipped (BOL Uploaded)' },
  { from: ['shipped'], to: 'balance_received', label: 'Mark as Balance Received' },
]

export default function TradeDetail() {
  const { id } = useParams<{ id: string }>()
  const { role } = useAuth()
  const { data: trade, isLoading } = useTrade(id)
  const { mutate: markMilestone, isPending: markingMilestone } = useMarkMilestoneReceived()
  const { mutate: updateStatus, isPending: updatingStatus } = useUpdateTradeStatus()
  const { mutate: sendContract, isPending: sendingContract } = useSendContractToClient()
  const [confirmMilestone, setConfirmMilestone] = useState<'advance' | 'balance' | null>(null)
  const [confirmStatus, setConfirmStatus] = useState<TradeStatus | null>(null)
  const [confirmSendContract, setConfirmSendContract] = useState(false)

  const isSuperAdmin = role === 'super_admin'

  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>
  if (!trade) return <div className="text-center py-20 text-gray-500">Trade not found</div>

  const availableTransition = STATUS_TRANSITIONS.find((t) => t.from.includes(trade.trade_status))

  return (
    <div className="space-y-6">
      <PageHeader
        title={trade.trade_reference}
        subtitle={`${trade.client?.company_name ?? ''} — ${formatDate(trade.contract_date)}`}
        breadcrumbs={[{ label: 'Trades', href: '/trades' }, { label: trade.trade_reference }]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to={`/trades/${trade.id}/folder`}
              title="Trade Folder"
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <FolderOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Trade Folder</span>
            </Link>
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setConfirmSendContract(true)}
                disabled={sendingContract}
                title={trade.contract_sent_at
                  ? `Last sent ${formatDatetime(trade.contract_sent_at)} — click to resend`
                  : 'Email the generated sales contract PDF to the client'}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">{trade.contract_sent_at ? 'Resend to Client' : 'Send to Client'}</span>
              </button>
            )}
            {isSuperAdmin && availableTransition && (
              <button
                type="button"
                onClick={() => setConfirmStatus(availableTransition.to)}
                title={availableTransition.label}
                className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
              >
                <span className="hidden sm:inline">{availableTransition.label}</span>
                {/* Mobile: short verb only so the button stays tappable on
                    320px viewports without horizontal scroll. */}
                <span className="sm:hidden">
                  {availableTransition.to === 'active' ? 'Send' :
                   availableTransition.to === 'shipped' ? 'Shipped' :
                   availableTransition.to === 'balance_received' ? 'Balance ✓' : 'Update'}
                </span>
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Status & Overview */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <StatusBadge status={trade.trade_status} className="mt-1" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Entity</p>
                <p className="mt-1 text-sm font-medium">{trade.entity?.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Incoterm</p>
                <p className="mt-1 text-sm font-medium">CFR</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Frigo Ref</p>
                <p className="mt-1 text-sm font-mono">{trade.frigo_contract_ref}</p>
              </div>
            </div>
          </div>

          {/* Financials */}
          <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Financial Breakdown</h3>
            <div className="space-y-2 text-sm">
              {isSuperAdmin && (
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-600">Frigo Purchase Price</span>
                  <span className="font-medium">{formatCurrency(trade.frigo_total)}</span>
                </div>
              )}
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
                <span className={`text-lg font-bold ${trade.net_profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {formatCurrency(trade.net_profit)}
                </span>
              </div>
            </div>
          </div>

          {/* Product info */}
          <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Cargo Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-gray-500">Quantity</p><p className="font-medium">{trade.quantity_tons} tons</p></div>
              <div><p className="text-gray-500">Sale Price/Ton</p><p className="font-medium">{formatCurrency(trade.sale_unit_price)}</p></div>
              <div className="col-span-2"><p className="text-gray-500">Product</p><p className="font-medium">{trade.product_description}</p></div>
            </div>
          </div>
        </div>

        {/* Milestones */}
        <div className="space-y-4">
          {/* Advance Milestone */}
          <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">50% Advance</h3>
              <StatusBadge status={trade.advance_status} />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Amount</span>
                <span className="font-semibold">{formatCurrency(trade.sale_total * 0.5)}</span>
              </div>
              {trade.signing_date && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Due</span>
                  <span>{formatDate(new Date(new Date(trade.signing_date).getTime() + 7 * 24 * 60 * 60 * 1000))}</span>
                </div>
              )}
              {trade.advance_received_at && (
                <div className="flex items-center gap-1 text-green-700 text-xs mt-2">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Received {formatDatetime(trade.advance_received_at)}
                </div>
              )}
            </div>
            {isSuperAdmin && trade.advance_status === 'pending' && (
              <button
                type="button"
                onClick={() => setConfirmMilestone('advance')}
                className="mt-3 w-full rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
              >
                Mark Advance Received
              </button>
            )}
            {trade.advance_status === 'overdue' && (
              <div className="mt-3 flex items-center gap-1 text-red-700 text-xs"><AlertTriangle className="h-3.5 w-3.5" />Overdue</div>
            )}
          </div>

          {/* Balance Milestone */}
          <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">50% Balance</h3>
              <StatusBadge status={trade.balance_status} />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Amount</span>
                <span className="font-semibold">{formatCurrency(trade.sale_total * 0.5)}</span>
              </div>
              {trade.bol_date && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Due</span>
                  <span>{formatDate(new Date(new Date(trade.bol_date).getTime() + 7 * 24 * 60 * 60 * 1000))}</span>
                </div>
              )}
              {trade.balance_received_at && (
                <div className="flex items-center gap-1 text-green-700 text-xs mt-2">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Received {formatDatetime(trade.balance_received_at)}
                </div>
              )}
            </div>
            {isSuperAdmin && trade.balance_status === 'pending' && trade.bol_date && (
              <button
                type="button"
                onClick={() => setConfirmMilestone('balance')}
                className="mt-3 w-full rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
              >
                Mark Balance Received
              </button>
            )}
            {trade.balance_status === 'overdue' && (
              <div className="mt-3 flex items-center gap-1 text-red-700 text-xs"><AlertTriangle className="h-3.5 w-3.5" />Overdue</div>
            )}
          </div>

          {/* Client Info */}
          <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Client</h3>
            <div className="space-y-1.5 text-sm">
              <p className="font-medium">{trade.client?.company_name}</p>
              <p className="text-gray-500">{trade.client?.address}</p>
              <p className="text-gray-500">{trade.client?.city}, {trade.client?.country}</p>
              <div className="pt-2 border-t border-gray-100">
                <p className="font-medium">{trade.contact?.full_name}</p>
                <p className="text-gray-500">{trade.contact?.email}</p>
                <p className="text-gray-500">{trade.contact?.phone}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmMilestone}
        onClose={() => setConfirmMilestone(null)}
        onConfirm={() => {
          if (confirmMilestone && id) {
            markMilestone({ id, milestone: confirmMilestone }, { onSuccess: () => setConfirmMilestone(null) })
          }
        }}
        title={`Mark ${confirmMilestone === 'advance' ? 'Advance' : 'Balance'} as Received`}
        description={`Are you sure you want to mark the ${confirmMilestone} payment as received? This will timestamp the payment.`}
        confirmLabel="Mark as Received"
        isLoading={markingMilestone}
        variant="warning"
      />

      <ConfirmDialog
        open={!!confirmStatus}
        onClose={() => setConfirmStatus(null)}
        onConfirm={() => {
          if (confirmStatus && id) {
            updateStatus({ id, status: confirmStatus }, { onSuccess: () => setConfirmStatus(null) })
          }
        }}
        title="Update trade status"
        description={`Change trade status to "${confirmStatus}"?`}
        confirmLabel="Update Status"
        isLoading={updatingStatus}
        variant="warning"
      />

      <ConfirmDialog
        open={confirmSendContract}
        onClose={() => setConfirmSendContract(false)}
        onConfirm={() => {
          if (id) sendContract(id, { onSuccess: () => setConfirmSendContract(false) })
        }}
        title={trade.contract_sent_at ? 'Resend contract to client' : 'Send contract to client'}
        description={
          trade.client?.contact_email
            ? `Email the generated sales contract (${trade.trade_reference}.pdf) to ${trade.client.contact_email}?${
                trade.contract_sent_at ? ` Last sent ${formatDatetime(trade.contract_sent_at)}.` : ''
              }`
            : 'This client has no contact email on file. Add one in the Client CMS first.'
        }
        confirmLabel={trade.contract_sent_at ? 'Resend' : 'Send'}
        isLoading={sendingContract}
        variant="warning"
      />
    </div>
  )
}
