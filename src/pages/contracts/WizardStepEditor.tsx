import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Lock, Unlock } from 'lucide-react'
import { FormField, Input } from '@/components/ui/FormField'
import { calculateFinancials, formatCurrency } from '@/lib/utils'
import type { ContractGenerationData } from '@/types'

interface Props {
  initialData: ContractGenerationData
  sourceFile: File
  onComplete: (data: ContractGenerationData) => void
  onBack: () => void
}

export function WizardStepEditor({ initialData, onComplete, onBack }: Props) {
  const [unlockedFields, setUnlockedFields] = useState<Set<string>>(new Set())
  const [financials, setFinancials] = useState({
    saleTotal: initialData.saleTotal,
    prepaymentAmount: initialData.prepaymentAmount,
    balanceAmount: initialData.balanceAmount,
  })

  const { register, handleSubmit, watch, setValue } = useForm<ContractGenerationData>({
    defaultValues: initialData,
  })

  const saleUnitPrice = watch('saleUnitPrice')
  const freightCost = watch('freightCost')
  const insuranceCost = watch('insuranceCost')
  const quantityTons = watch('quantityTons')

  useEffect(() => {
    const qty = Number(quantityTons) || 0
    const price = Number(saleUnitPrice) || 0
    const freight = Number(freightCost) || 0
    const insurance = Number(insuranceCost) || 0
    const calc = calculateFinancials(qty, price, initialData.frigoTotal || 0, freight, insurance, 0)
    setFinancials({
      saleTotal: calc.saleTotal,
      prepaymentAmount: calc.prepaymentAmount,
      balanceAmount: calc.balanceAmount,
    })
    setValue('saleTotal', calc.saleTotal)
    setValue('prepaymentAmount', calc.prepaymentAmount)
    setValue('balanceAmount', calc.balanceAmount)
  }, [saleUnitPrice, freightCost, insuranceCost, quantityTons, initialData.frigoTotal, setValue])

  const toggleLock = (field: string) => {
    setUnlockedFields((prev) => {
      const next = new Set(prev)
      if (next.has(field)) next.delete(field)
      else next.add(field)
      return next
    })
  }

  const isLocked = (field: string) => !unlockedFields.has(field)

  const onSubmit = (data: ContractGenerationData) => {
    onComplete({ ...data, saleTotal: financials.saleTotal, prepaymentAmount: financials.prepaymentAmount, balanceAmount: financials.balanceAmount })
  }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="rounded-xl border border-gray-200 p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  )

  const LockedField = ({ label, field, value }: { label: string; field: string; value: string }) => (
    <FormField label={label}>
      <div className="flex items-center gap-2">
        <Input value={value} disabled={isLocked(field)} readOnly={isLocked(field)} className="flex-1" {...register(field as keyof ContractGenerationData)} />
        <button type="button" onClick={() => toggleLock(field)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 transition-colors" title={isLocked(field) ? 'Unlock field' : 'Lock field'}>
          {isLocked(field) ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4 text-brand-600" />}
        </button>
      </div>
    </FormField>
  )

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Contract Editor</h2>
        <p className="mt-1 text-sm text-gray-500">Review and edit all contract fields. Locked fields are mirrored exactly from the source.</p>
      </div>

      <form className="space-y-5">
        <Section title="A — Entity & Client">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Acting Entity Name" required>
              <Input {...register('entityName')} />
            </FormField>
            <FormField label="Entity Country">
              <Input {...register('entityCountry')} />
            </FormField>
            <FormField label="Client Name" required>
              <Input {...register('clientName')} />
            </FormField>
            <FormField label="Client Country">
              <Input {...register('clientCountry')} />
            </FormField>
            <FormField label="Client Address">
              <Input {...register('clientAddress')} />
            </FormField>
            <FormField label="Client City">
              <Input {...register('clientCity')} />
            </FormField>
            <FormField label="Contact Person">
              <Input {...register('contactPerson')} />
            </FormField>
            <FormField label="Contact Phone">
              <Input {...register('contactPhone')} />
            </FormField>
            <FormField label="Contact Email" className="col-span-2">
              <Input {...register('contactEmail')} />
            </FormField>
            <FormField label="Contract Date" required>
              <Input type="date" {...register('contractDate')} />
            </FormField>
            <FormField label="Frigo Contract Ref">
              <Input {...register('frigoContractRef')} />
            </FormField>
          </div>
        </Section>

        <Section title="B — Products Table">
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Quantity (Tons) — Locked">
              <div className="flex items-center gap-2">
                <Input value={initialData.quantityTons} readOnly className="bg-gray-50 flex-1" disabled />
                <Lock className="h-4 w-4 text-gray-300" />
              </div>
            </FormField>
            <FormField label="Sale Unit Price (USD)" required>
              <Input type="number" step="0.001" {...register('saleUnitPrice', { valueAsNumber: true })} />
            </FormField>
            <FormField label="Sale Total (Auto)">
              <Input value={formatCurrency(financials.saleTotal)} readOnly className="bg-gray-50" />
            </FormField>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
            <strong>Product:</strong> {initialData.productDescription}
          </div>
        </Section>

        <Section title="C — Cargo Specs (Pure Mirror — Locked)">
          <div className="grid grid-cols-2 gap-3">
            <LockedField label="Brand" field="brand" value={watch('brand') || initialData.brand} />
            <LockedField label="Validity" field="validity" value={watch('validity') || initialData.validity} />
            <LockedField label="Temperature" field="temperature" value={watch('temperature') || initialData.temperature} />
            <LockedField label="Packing" field="packing" value={watch('packing') || initialData.packing} />
            <LockedField label="Shipment Date" field="shipmentsDate" value={watch('shipmentsDate') || initialData.shipmentsDate} />
            <LockedField label="Plant No." field="plantNo" value={watch('plantNo') || initialData.plantNo} />
            <LockedField label="Origin" field="origin" value={watch('origin') || initialData.origin} />
            <LockedField label="Destination" field="destination" value={watch('destination') || initialData.destination} />
          </div>
        </Section>

        <Section title="D — Payment Terms">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Prepayment Date">
              <Input {...register('prepaymentDate')} placeholder="APR/27/2026" />
            </FormField>
            <FormField label="Prepayment Amount (Auto)">
              <Input value={formatCurrency(financials.prepaymentAmount)} readOnly className="bg-gray-50" />
            </FormField>
            <FormField label="Balance Amount (Auto)" className="col-span-2">
              <Input value={formatCurrency(financials.balanceAmount)} readOnly className="bg-gray-50" />
            </FormField>
          </div>
        </Section>

        <Section title="E — Costs">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Freight Cost (USD)">
              <Input type="number" step="0.01" min="0" {...register('freightCost', { valueAsNumber: true })} />
            </FormField>
            <FormField label="Insurance Cost (USD)">
              <Input type="number" step="0.01" min="0" {...register('insuranceCost', { valueAsNumber: true })} />
            </FormField>
          </div>
        </Section>

        <Section title="F — Banking">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Intermediary Bank">
              <Input {...register('intermediaryBankName')} />
            </FormField>
            <FormField label="Intermediary SWIFT">
              <Input {...register('intermediaryBankSwift')} />
            </FormField>
            <FormField label="Bank Name">
              <Input {...register('bankName')} />
            </FormField>
            <FormField label="Bank SWIFT">
              <Input {...register('bankSwift')} />
            </FormField>
            <FormField label="Account Number" className="col-span-2">
              <Input {...register('accountNumber')} />
            </FormField>
            <FormField label="Beneficiary Name">
              <Input {...register('beneficiaryName')} />
            </FormField>
            <FormField label="Beneficiary Address">
              <Input {...register('beneficiaryAddress')} />
            </FormField>
          </div>
        </Section>
      </form>

      {/* Financial summary */}
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
        <h3 className="text-sm font-semibold text-brand-800 mb-3">Financial Summary</h3>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div><p className="text-gray-500">Sale Total</p><p className="font-semibold text-gray-900">{formatCurrency(financials.saleTotal)}</p></div>
          <div><p className="text-gray-500">50% Advance</p><p className="font-semibold text-gray-900">{formatCurrency(financials.prepaymentAmount)}</p></div>
          <div><p className="text-gray-500">50% Balance</p><p className="font-semibold text-gray-900">{formatCurrency(financials.balanceAmount)}</p></div>
        </div>
      </div>

      <div className="flex justify-between pt-4 border-t border-gray-100">
        <button onClick={onBack} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Back</button>
        <button onClick={handleSubmit(onSubmit)} className="rounded-xl bg-brand-600 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors">
          Preview Contract
        </button>
      </div>
    </div>
  )
}
