import { useEffect, useRef, useState } from 'react'
import { CheckCircle, FolderOpen, Plus, LayoutDashboard } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { downloadBlob } from '@/lib/utils'
import type { ContractGenerationData } from '@/types'

interface Props {
  contractData: ContractGenerationData
  generatedPdf: Uint8Array
  sourceFile: File
  onDone: () => void
}

export function WizardStepDownload({ contractData, generatedPdf, sourceFile, onDone }: Props) {
  const { user } = useAuth()
  const [status, setStatus] = useState<'saving' | 'done' | 'error'>('saving')
  const [tradeId, setTradeId] = useState<string | null>(null)
  const [tradeRef, setTradeRef] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Guards against re-running save+download more than once per mount. React
  // 18 StrictMode double-mounts effects in dev, and any dependency reference
  // change (e.g. AuthContext re-emits `user`) used to fire the effect again
  // — which downloaded the PDF a second time AND inserted a duplicate trade.
  const hasRunRef = useRef(false)

  useEffect(() => {
    if (hasRunRef.current) return
    hasRunRef.current = true

    async function saveAndDownload() {
      try {
        const blob = new Blob([generatedPdf.buffer as ArrayBuffer], { type: 'application/pdf' })

        // 1. Create trade record FIRST so we can name the download with the
        //    real trade reference (e.g. "CF-2026-031.pdf"). Previously the
        //    download fired immediately with the Frigo contract reference,
        //    which is the SOURCE doc's name and confusing in the
        //    user's downloads folder.
        const { count } = await supabase.from('trades').select('*', { count: 'exact', head: true })
        const year = new Date().getFullYear()
        const num = String((count ?? 0) + 1).padStart(3, '0')
        const trade_reference = `CF-${year}-${num}`

        const totalAddedCosts = contractData.freightCost + contractData.insuranceCost + (contractData.bankFees ?? 0)
        const finances = {
          total_costs: contractData.frigoTotal + totalAddedCosts,
          net_profit: contractData.saleTotal - (contractData.frigoTotal + totalAddedCosts),
        }

        const { data: trade, error: tradeError } = await supabase.from('trades').insert({
          trade_reference,
          entity_id: contractData.entityId,
          bank_profile_id: contractData.bankProfileId,
          client_id: contractData.clientId,
          contact_id: contractData.contactId,
          contract_date: contractData.contractDate,
          frigo_contract_ref: contractData.frigoContractRef,
          quantity_tons: contractData.quantityTons,
          product_description: contractData.productDescription,
          // Persist the parsed unit price so the §9.1 invariant
          // `frigo_total = quantity × frigo_unit_price` holds. If the
          // parser couldn't read it, derive it from total ÷ quantity.
          frigo_unit_price: contractData.frigoUnitPrice
            || (contractData.quantityTons > 0 ? contractData.frigoTotal / contractData.quantityTons : 0),
          frigo_total: contractData.frigoTotal || 0,
          sale_unit_price: contractData.saleUnitPrice,
          sale_total: contractData.saleTotal,
          shipping_cost: contractData.freightCost,
          insurance_cost: contractData.insuranceCost,
          bank_fees: contractData.bankFees ?? 0,
          total_costs: finances.total_costs,
          net_profit: finances.net_profit,
          advance_status: 'pending',
          balance_status: 'pending',
          trade_status: 'draft',
        }).select().single()

        if (tradeError) throw tradeError
        if (!user?.id) throw new Error('Cannot save documents — no authenticated user')
        setTradeId(trade.id)
        setTradeRef(trade.trade_reference)

        // 2. Trigger browser download with the real trade reference as
        //    the filename. Sanitised against path separators just in case
        //    the format ever changes.
        const safeRef = trade.trade_reference.replace(/[\\/]/g, '-')
        downloadBlob(blob, `${safeRef}.pdf`)

        // 3. Upload BOTH PDFs to storage. Each upload is error-checked
        //    explicitly because previously a silent storage failure left
        //    the trade row created but the Trade Folder empty (user
        //    reported "where did my contract go?" after wizard completed).
        const salesContractPath = `contracts/${trade_reference}/sales_contract.pdf`
        const { error: salesUploadErr } = await supabase.storage
          .from('trade-documents')
          .upload(salesContractPath, blob, { upsert: true, contentType: 'application/pdf' })
        if (salesUploadErr) throw new Error(`Sales contract upload failed: ${salesUploadErr.message}`)

        const frigoPath = `contracts/${trade_reference}/frigo_contract.pdf`
        const { error: frigoUploadErr } = await supabase.storage
          .from('trade-documents')
          .upload(frigoPath, sourceFile, { upsert: true, contentType: 'application/pdf' })
        if (frigoUploadErr) throw new Error(`Frigo contract upload failed: ${frigoUploadErr.message}`)

        // 4. Create document records — also error-checked. Without these
        //    rows in the documents table, useDocuments(tradeId) returns
        //    [] and the Trade Folder UI shows empty upload slots even
        //    though the files exist in storage.
        const { error: docsInsertErr } = await supabase.from('documents').insert([
          {
            trade_id: trade.id,
            document_type: 'frigo_contract' as const,
            file_name: sourceFile.name,
            storage_path: frigoPath,
            uploaded_by: user.id,
          },
          {
            trade_id: trade.id,
            document_type: 'sales_contract' as const,
            file_name: `${trade_reference}-sales-contract.pdf`,
            storage_path: salesContractPath,
            uploaded_by: user.id,
          },
        ])
        if (docsInsertErr) throw new Error(`Document records insert failed: ${docsInsertErr.message}`)

        // 5. Log audit (non-fatal — don't block trade-creation success on it)
        const { error: auditErr } = await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'contract_generated',
          entity_type: 'trade',
          entity_id: trade.id,
          new_value: { trade_reference, client: contractData.clientName },
        })
        if (auditErr) console.warn('[contract-download] audit log insert failed:', auditErr.message)

        setStatus('done')
      } catch (err) {
        console.error('[contract-download] saveAndDownload error:', err)
        setErrorMsg(err instanceof Error ? err.message : 'Failed to save trade')
        setStatus('error')
      }
    }

    saveAndDownload()
    // Intentionally empty — guarded by hasRunRef. Adding contractData /
    // generatedPdf / sourceFile / user to deps would re-trigger the
    // download on any unrelated re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center">
      {status === 'saving' && (
        <>
          <LoadingSpinner size="lg" />
          <div>
            <p className="text-lg font-semibold text-gray-900">Saving contract...</p>
            <p className="text-sm text-gray-500 mt-1">Uploading documents and creating trade record</p>
          </div>
        </>
      )}

      {status === 'done' && (
        <>
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">Contract Generated!</p>
            <p className="text-sm text-gray-500 mt-1">Trade reference: <strong className="text-brand-600 font-mono">{tradeRef}</strong></p>
            <p className="text-sm text-gray-500 mt-1">The contract has been downloaded and saved to the trade folder.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to={`/trades/${tradeId}`}
              className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <FolderOpen className="h-4 w-4" />
              View Trade
            </Link>
            <Link
              to="/contracts/new"
              className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Contract
            </Link>
            <Link
              to="/dashboard"
              className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
          </div>
        </>
      )}

      {status === 'error' && (
        <div className="space-y-4">
          <p className="text-red-600 font-semibold">Error saving trade</p>
          <p className="text-sm text-gray-500">{errorMsg}</p>
          <p className="text-sm text-gray-500">Your PDF was downloaded. Please try creating the trade manually.</p>
          <button onClick={onDone} className="rounded-xl bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
            Go to Trades
          </button>
        </div>
      )}
    </div>
  )
}
