import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Upload, Download, Trash2, Archive, FileText } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { FileUpload } from '@/components/ui/FileUpload'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useTrade, useUpdateTrade } from '@/hooks/useTrades'
import { useDocuments, useUploadDocument, useDeleteDocument, useDownloadDocument, useGenerateAuditZip } from '@/hooks/useDocuments'
import { formatDate, formatDatetime } from '@/lib/utils'
import type { DocumentType, TradeDocument } from '@/types'

const DOCUMENT_SLOTS: { type: DocumentType; label: string; description: string; canUpload: boolean; canDelete: boolean }[] = [
  { type: 'frigo_contract', label: 'Original Frigo Contract', description: 'Purchase contract from Frigorífico Concepción', canUpload: true, canDelete: false },
  { type: 'sales_contract', label: 'Generated Sales Contract', description: 'Auto-saved when contract is downloaded', canUpload: false, canDelete: false },
  { type: 'signed_contract', label: 'Signed Sales Contract', description: 'Upload after external signing', canUpload: true, canDelete: true },
  { type: 'bol', label: 'Bill of Lading (BOL)', description: 'Upload when shipment is confirmed', canUpload: true, canDelete: true },
]

export default function TradeFolder() {
  const { id } = useParams<{ id: string }>()
  const { data: trade, isLoading: tradeLoading } = useTrade(id)
  const { data: documents, isLoading: docsLoading } = useDocuments(id)
  const { mutate: uploadDoc, isPending: uploading } = useUploadDocument()
  const { mutate: deleteDoc, isPending: deleting } = useDeleteDocument()
  const { mutate: downloadDoc } = useDownloadDocument()
  const { mutate: generateZip, isPending: zipping } = useGenerateAuditZip()
  const { mutate: updateTrade } = useUpdateTrade()
  const [deleteTarget, setDeleteTarget] = useState<TradeDocument | null>(null)
  const [bolDate, setBolDate] = useState(trade?.bol_date ?? '')

  if (tradeLoading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>
  if (!trade) return <div className="py-20 text-center text-gray-500">Trade not found</div>

  const getDocByType = (type: DocumentType) => documents?.find((d) => d.document_type === type)

  const handleUpload = (file: File, type: DocumentType) => {
    uploadDoc({ tradeId: trade.id, file, documentType: type, tradeRef: trade.trade_reference })
    if (type === 'bol' && bolDate) {
      updateTrade({ id: trade.id, data: { bol_date: bolDate, trade_status: 'shipped' } })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trade Folder"
        subtitle={trade.trade_reference}
        breadcrumbs={[
          { label: 'Trades', href: '/trades' },
          { label: trade.trade_reference, href: `/trades/${trade.id}` },
          { label: 'Folder' },
        ]}
        actions={
          <button
            onClick={() => generateZip({ tradeRef: trade.trade_reference, documents: documents ?? [] })}
            disabled={!documents?.length || zipping}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {zipping ? <LoadingSpinner size="sm" /> : <Archive className="h-4 w-4" />}
            Audit Trail ZIP
          </button>
        }
      />

      {/* Document slots */}
      <div className="space-y-4">
        {DOCUMENT_SLOTS.map((slot) => {
          const doc = getDocByType(slot.type)
          return (
            <div key={slot.type} className="rounded-xl bg-white border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{slot.label}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{slot.description}</p>
                </div>
                {doc && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadDoc({ storagePath: doc.storage_path, fileName: doc.file_name })}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </button>
                    {slot.canDelete && (
                      <button
                        onClick={() => setDeleteTarget(doc)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {doc ? (
                <div className="flex items-center gap-3 rounded-lg bg-green-50 border border-green-100 px-4 py-3">
                  <FileText className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-800">{doc.file_name}</p>
                    <p className="text-xs text-green-600">Uploaded {formatDatetime(doc.uploaded_at)}</p>
                  </div>
                </div>
              ) : slot.canUpload ? (
                <div className="space-y-2">
                  {slot.type === 'bol' && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-gray-600">BOL Date:</label>
                      <input
                        type="date"
                        value={bolDate}
                        onChange={(e) => setBolDate(e.target.value)}
                        className="rounded border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  )}
                  <FileUpload
                    onFileSelect={(file) => handleUpload(file, slot.type)}
                    isUploading={uploading}
                    label={`Upload ${slot.label}`}
                    description="PDF only"
                    className="py-0"
                  />
                </div>
              ) : (
                <div className="rounded-lg bg-gray-50 border border-dashed border-gray-200 px-4 py-3 text-center text-xs text-gray-400">
                  {slot.type === 'sales_contract' ? 'Will appear after contract is generated' : 'Not yet uploaded'}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Additional documents */}
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Additional Documents</h3>
        {documents?.filter((d) => d.document_type === 'other').map((doc) => (
          <div key={doc.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 mb-2">
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">{doc.file_name}</p>
                <p className="text-xs text-gray-500">{formatDatetime(doc.uploaded_at)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => downloadDoc({ storagePath: doc.storage_path, fileName: doc.file_name })} className="text-xs text-brand-600 hover:text-brand-700">Download</button>
              <button onClick={() => setDeleteTarget(doc)} className="text-xs text-red-600 hover:text-red-700">Delete</button>
            </div>
          </div>
        ))}
        <FileUpload
          onFileSelect={(file) => handleUpload(file, 'other')}
          isUploading={uploading}
          label="Upload additional document"
          description="Any file type, max 10MB"
          accept={{ 'application/pdf': ['.pdf'], 'image/*': ['.png', '.jpg', '.jpeg'] }}
        />
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteDoc({ id: deleteTarget.id, storagePath: deleteTarget.storage_path, tradeId: trade.id }, {
              onSuccess: () => setDeleteTarget(null),
            })
          }
        }}
        title="Delete document"
        description={`Delete "${deleteTarget?.file_name}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleting}
      />
    </div>
  )
}
