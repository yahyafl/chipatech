import { useEffect, useState } from 'react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { generateMirroredContract, calibrateOverlays } from '@/lib/pdfGenerator'
import { downloadBlob } from '@/lib/utils'
import type { ContractGenerationData } from '@/types'

interface Props {
  contractData: ContractGenerationData
  sourceFile: File
  onPdfGenerated: (pdf: Uint8Array) => void
  onComplete: () => void
  onBack: () => void
}

async function downloadCalibration(sourceFile: File) {
  const buffer = await sourceFile.arrayBuffer()
  const pdfBytes = await calibrateOverlays(buffer)
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
  downloadBlob(blob, 'calibration-overlay.pdf')
}

export function WizardStepPreview({ contractData, sourceFile, onPdfGenerated, onComplete, onBack }: Props) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let url: string | null = null
    async function generate() {
      try {
        const buffer = await sourceFile.arrayBuffer()
        const pdfBytes = await generateMirroredContract(buffer, contractData)
        onPdfGenerated(pdfBytes)
        const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
        url = URL.createObjectURL(blob)
        setPdfUrl(url)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate PDF')
      } finally {
        setIsGenerating(false)
      }
    }
    generate()
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [contractData, sourceFile, onPdfGenerated])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Preview Contract</h2>
        <p className="mt-1 text-sm text-gray-500">Review the generated mirrored sales contract before downloading.</p>
      </div>

      {isGenerating && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-sm font-medium text-gray-500">Generating mirrored contract...</p>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {pdfUrl && (
        <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
          <iframe
            src={pdfUrl}
            className="w-full h-[600px]"
            title="Contract Preview"
          />
        </div>
      )}

      <div className="flex justify-between pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Back to Edit</button>
          {/* Calibration tool — only visible in dev mode (not in production
              builds). Used for adjusting the PDF overlay coordinate map. */}
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={() => void downloadCalibration(sourceFile)}
              className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50 transition-colors"
              title="Dev only — download a PDF with coloured boxes showing where each overlay field lands"
            >
              Calibration PDF
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onComplete}
          disabled={isGenerating || !!error}
          className="rounded-xl bg-brand-600 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          Looks good — Download
        </button>
      </div>
    </div>
  )
}
