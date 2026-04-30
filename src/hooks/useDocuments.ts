import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import JSZip from 'jszip'
import { downloadBlob } from '@/lib/utils'
import type { TradeDocument, DocumentType } from '@/types'
import { useAuth } from '@/context/AuthContext'

export function useDocuments(tradeId: string | undefined) {
  return useQuery({
    queryKey: ['documents', tradeId],
    queryFn: async () => {
      if (!tradeId) return []
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('trade_id', tradeId)
        .order('uploaded_at', { ascending: false })
      if (error) throw error
      return data as TradeDocument[]
    },
    enabled: !!tradeId,
  })
}

// Hardening (audit H-2): block oversized files, non-PDFs, and PDFs that
// fail the %PDF- magic-byte sniff. Also sanitize the filename so we
// never write attacker-controlled paths into Storage.
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024 // 8 MB ceiling

function sanitizeFileName(name: string): string {
  // Strip path traversal, control chars, and anything that isn't
  // alphanumeric / dash / underscore / dot. Keep extension last.
  const cleaned = name
    .replace(/[\\/]/g, '_')
    .replace(/[^\w.\-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80)
  return cleaned || 'document.pdf'
}

async function assertValidPdf(file: File): Promise<void> {
  if (file.size === 0) throw new Error('File is empty')
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`File exceeds ${MAX_UPLOAD_BYTES / 1024 / 1024} MB limit`)
  if (file.type && file.type !== 'application/pdf') {
    throw new Error('Only PDF files are accepted')
  }
  // %PDF- magic-byte sniff — covers cases where the MIME type is missing
  // or spoofed. Real PDFs always start with these 5 bytes.
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer())
  const isPDF = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46 && head[4] === 0x2D
  if (!isPDF) throw new Error('File does not look like a real PDF')
}

export function useUploadDocument() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({
      tradeId,
      file,
      documentType,
      tradeRef,
    }: {
      tradeId: string
      file: File
      documentType: DocumentType
      tradeRef: string
    }) => {
      await assertValidPdf(file)

      const safeName = sanitizeFileName(file.name)
      const path = `contracts/${tradeRef}/${documentType}_${Date.now()}_${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('trade-documents')
        .upload(path, file, { upsert: true, contentType: 'application/pdf' })
      if (uploadError) throw uploadError

      const { data, error } = await supabase
        .from('documents')
        .insert({
          trade_id: tradeId,
          document_type: documentType,
          file_name: safeName,
          storage_path: path,
          uploaded_by: user?.id ?? '',
        })
        .select()
        .single()
      if (error) throw error
      return data as TradeDocument
    },
    onSuccess: (_, { tradeId }) => {
      qc.invalidateQueries({ queryKey: ['documents', tradeId] })
      toast.success('Document uploaded')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useDeleteDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, storagePath, tradeId }: { id: string; storagePath: string; tradeId: string }) => {
      await supabase.storage.from('trade-documents').remove([storagePath])
      const { error } = await supabase.from('documents').delete().eq('id', id)
      if (error) throw error
      return tradeId
    },
    onSuccess: (tradeId) => {
      qc.invalidateQueries({ queryKey: ['documents', tradeId] })
      toast.success('Document deleted')
    },
  })
}

export function useDownloadDocument() {
  return useMutation({
    mutationFn: async ({ storagePath, fileName }: { storagePath: string; fileName: string }) => {
      const { data, error } = await supabase.storage
        .from('trade-documents')
        .download(storagePath)
      if (error) throw error
      downloadBlob(data, fileName)
    },
  })
}

export function useGenerateAuditZip() {
  return useMutation({
    mutationFn: async ({ tradeRef, documents }: { tradeRef: string; documents: TradeDocument[] }) => {
      const zip = new JSZip()
      for (const doc of documents) {
        const { data, error } = await supabase.storage
          .from('trade-documents')
          .download(doc.storage_path)
        if (!error && data) {
          zip.file(doc.file_name, data)
        }
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      downloadBlob(blob, `${tradeRef}-audit-trail.zip`)
    },
    onSuccess: () => toast.success('Audit trail ZIP downloaded'),
  })
}
