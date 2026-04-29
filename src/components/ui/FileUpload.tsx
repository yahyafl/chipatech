import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, File, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  accept?: Record<string, string[]>
  maxSize?: number
  onFileSelect: (file: File) => void
  isUploading?: boolean
  label?: string
  description?: string
  className?: string
}

export function FileUpload({
  accept = { 'application/pdf': ['.pdf'] },
  maxSize = 10 * 1024 * 1024,
  onFileSelect,
  isUploading = false,
  label = 'Upload file',
  description = 'PDF up to 10MB',
  className,
}: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) {
      setSelectedFile(file)
      onFileSelect(file)
    }
  }, [onFileSelect])

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: false,
  })

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedFile(null)
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors',
          isDragActive
            ? 'border-brand-500 bg-brand-50'
            : 'border-gray-200 bg-gray-50 hover:border-brand-400 hover:bg-brand-50',
          isUploading && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} disabled={isUploading} />
        {selectedFile ? (
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-brand-100 p-2">
              <File className="h-6 w-6 text-brand-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
              <p className="text-xs text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <button
              onClick={clearFile}
              className="ml-2 rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="rounded-full bg-gray-100 p-3 mb-3">
              <Upload className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-700">{label}</p>
            <p className="mt-1 text-xs text-gray-500">{description}</p>
            {isDragActive && <p className="mt-2 text-xs font-medium text-brand-600">Drop the file here</p>}
          </>
        )}
      </div>
      {fileRejections.length > 0 && (
        <p className="text-xs text-red-600">
          {fileRejections[0].errors[0].message}
        </p>
      )}
    </div>
  )
}
