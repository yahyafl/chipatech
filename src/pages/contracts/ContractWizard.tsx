import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExtractedContract, ContractGenerationData } from '@/types'
import { WizardStepUpload } from './WizardStepUpload'
import { WizardStepSetup } from './WizardStepSetup'
import { WizardStepEditor } from './WizardStepEditor'
import { WizardStepPreview } from './WizardStepPreview'
import { WizardStepDownload } from './WizardStepDownload'

const STEPS = [
  { id: 1, label: 'Upload' },
  { id: 2, label: 'Setup' },
  { id: 3, label: 'Edit' },
  { id: 4, label: 'Preview' },
  { id: 5, label: 'Download' },
]

export default function ContractWizard() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [extracted, setExtracted] = useState<ExtractedContract | null>(null)
  const [contractData, setContractData] = useState<ContractGenerationData | null>(null)
  const [generatedPdf, setGeneratedPdf] = useState<Uint8Array | null>(null)

  const goNext = () => setCurrentStep((s) => Math.min(s + 1, 5))
  const goBack = () => setCurrentStep((s) => Math.max(s - 1, 1))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Contract</h1>
        <p className="mt-1 text-sm text-gray-500">Generate a mirrored sales contract from the Frigo purchase contract</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((step, idx) => (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all',
                  currentStep > step.id
                    ? 'bg-brand-600 text-white'
                    : currentStep === step.id
                    ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                    : 'bg-gray-200 text-gray-500'
                )}
              >
                {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
              </div>
              <span className={cn(
                'mt-1.5 text-xs font-medium',
                currentStep === step.id ? 'text-brand-700' : 'text-gray-500'
              )}>
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={cn('flex-1 h-0.5 mx-2 mt-[-18px]', currentStep > step.id ? 'bg-brand-600' : 'bg-gray-200')} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
        {currentStep === 1 && (
          <WizardStepUpload
            onComplete={(file, data) => {
              setSourceFile(file)
              setExtracted(data)
              goNext()
            }}
          />
        )}
        {currentStep === 2 && extracted && (
          <WizardStepSetup
            extracted={extracted}
            onComplete={(setup) => {
              setContractData(setup)
              goNext()
            }}
            onBack={goBack}
          />
        )}
        {currentStep === 3 && contractData && sourceFile && (
          <WizardStepEditor
            initialData={contractData}
            sourceFile={sourceFile}
            onComplete={(data) => {
              setContractData(data)
              goNext()
            }}
            onBack={goBack}
          />
        )}
        {currentStep === 4 && contractData && sourceFile && (
          <WizardStepPreview
            contractData={contractData}
            sourceFile={sourceFile}
            onPdfGenerated={setGeneratedPdf}
            onComplete={goNext}
            onBack={goBack}
          />
        )}
        {currentStep === 5 && contractData && generatedPdf && sourceFile && (
          <WizardStepDownload
            contractData={contractData}
            generatedPdf={generatedPdf}
            sourceFile={sourceFile}
            onDone={() => navigate('/trades')}
          />
        )}
      </div>
    </div>
  )
}
