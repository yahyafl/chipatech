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
      const path = `contracts/${tradeRef}/${documentType}_${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('trade-documents')
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data, error } = await supabase
        .from('documents')
        .insert({
          trade_id: tradeId,
          document_type: documentType,
          file_name: file.name,
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
