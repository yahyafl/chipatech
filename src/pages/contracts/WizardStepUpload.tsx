import { useState } from 'react'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { FileUpload } from '@/components/ui/FileUpload'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { extractContractData } from '@/lib/pdfExtractor'
import type { ExtractedContract } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  onComplete: (file: File, data: ExtractedContract) => void
}

export function WizardStepUpload({ onComplete }: Props) {
  const [isExtracting, setIsExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extracted, setExtracted] = useState<ExtractedContract | null>(null)

  const handleFile = async (file: File) => {
    setIsExtracting(true)
    setError(null)
    try {
      const data = await extractContractData(file)
      setExtracted(data)
      // Auto-advance after a short delay
      setTimeout(() => onComplete(file, data), 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract contract data')
      setIsExtracting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Upload Frigo Contract</h2>
        <p className="mt-1 text-sm text-gray-500">Upload the Frigorífico Concepción PDF contract. The system will automatically extract all field data.</p>
      </div>

      <FileUpload
        onFileSelect={handleFile}
        isUploading={isExtracting}
        label="Drop Frigo contract PDF here"
        description="PDF only, max 10MB"
      />

      {isExtracting && (
        <div className="flex items-center gap-3 rounded-xl bg-brand-50 p-4 border border-brand-100">
          <LoadingSpinner size="sm" />
          <p className="text-sm font-medium text-brand-700">Extracting contract data...</p>
        </div>
      )}

      {extracted && (
        <div className="rounded-xl bg-green-50 p-4 border border-green-100">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-sm font-semibold text-green-800">Extraction successful</p>
            <span className={cn(
              'ml-auto rounded-full px-2 py-0.5 text-xs font-medium',
              extracted.confidence === 'high' ? 'bg-green-100 text-green-700' :
              extracted.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            )}>
              {extracted.confidence} confidence
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-green-700">
            <div>Product: {extracted.productDescription.substring(0, 40)}...</div>
            <div>Qty: {extracted.quantityTons} tons</div>
            <div>Unit Price: ${extracted.frigoUnitPrice.toFixed(3)}</div>
            <div>Total: ${extracted.frigoTotal.toLocaleString()}</div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-4 border border-red-100">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  )
}
