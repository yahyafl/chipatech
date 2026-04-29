import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Download, FileText } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { FileUpload } from '@/components/ui/FileUpload'
import { useTrade } from '@/hooks/useTrades'
import { useDocuments, useUploadDocument, useDownloadDocument } from '@/hooks/useDocuments'
import { formatDatetime } from '@/lib/utils'
import type { DocumentType } from '@/types'

const UPLOAD_SLOTS: { type: DocumentType; label: string }[] = [
  { type: 'bol', label: 'Bill of Lading' },
  { type: 'signed_contract', label: 'Signed Sales Contract' },
  { type: 'other', label: 'Additional Document' },
]

export default function InternalTradeFolder() {
  const { id } = useParams<{ id: string }>()
  const { data: trade, isLoading: tradeLoading } = useTrade(id)
  const { data: documents, isLoading: docsLoading } = useDocuments(id)
  const { mutate: uploadDoc, isPending: uploading } = useUploadDocument()
  const { mutate: downloadDoc } = useDownloadDocument()
  const [uploadType, setUploadType] = useState<DocumentType>('bol')

  if (tradeLoading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>
  if (!trade) return <div className="py-20 text-center text-gray-500">Trade not found</div>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trade Folder"
        subtitle={trade.trade_reference}
        breadcrumbs={[{ label: 'Trades', href: '/internal/trades' }, { label: trade.trade_reference }]}
      />

      {/* Existing documents */}
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Documents</h3>
        {docsLoading ? <LoadingSpinner /> : documents?.length === 0 ? (
          <p className="text-sm text-gray-500">No documents yet</p>
        ) : (
          <div className="space-y-2">
            {documents?.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{doc.file_name}</p>
                    <p className="text-xs text-gray-500 capitalize">{doc.document_type.replace('_', ' ')} · {formatDatetime(doc.uploaded_at)}</p>
                  </div>
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

      {/* Upload */}
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Upload Document</h3>
        <div className="mb-3">
          <label className="text-sm font-medium text-gray-700">Document Type</label>
          <select
            value={uploadType}
            onChange={(e) => setUploadType(e.target.value as DocumentType)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            {UPLOAD_SLOTS.map((s) => <option key={s.type} value={s.type}>{s.label}</option>)}
          </select>
        </div>
        <FileUpload
          onFileSelect={(file) => uploadDoc({ tradeId: trade.id, file, documentType: uploadType, tradeRef: trade.trade_reference })}
          isUploading={uploading}
          label="Upload document"
          description="PDF file"
        />
      </div>
    </div>
  )
}
