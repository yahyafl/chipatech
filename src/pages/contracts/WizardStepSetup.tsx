import { useState, useEffect } from 'react'
import { useWizardSetupData } from '@/hooks/useWizardSetupData'
import { FormField, Input, Select } from '@/components/ui/FormField'
import { calculateFinancials } from '@/lib/utils'
import type { ExtractedContract, ContractGenerationData } from '@/types'
import { format } from 'date-fns'

interface Props {
  extracted: ExtractedContract
  onComplete: (data: ContractGenerationData) => void
  onBack: () => void
}

export function WizardStepSetup({ extracted, onComplete, onBack }: Props) {
  const { data: setup } = useWizardSetupData()

  const entities     = setup.entities
  const bankProfiles = setup.bank_profiles
  const clients      = setup.clients
  const contacts     = setup.contacts

  const [entityId,      setEntityId]      = useState('')
  const [bankProfileId, setBankProfileId] = useState('')
  const [clientId,      setClientId]      = useState('')
  const [contactId,     setContactId]     = useState('')
  // Contract Date controls the "Date of Issue" field on the mirrored PDF
  // and is the anchor for the prepayment due-date (signing + 7 days).
  // Default = today; admin can override.
  const [contractDate,  setContractDate]  = useState(() => format(new Date(), 'yyyy-MM-dd'))

  // Pre-select defaults
  useEffect(() => {
    if (entities.length && !entityId) setEntityId(entities[0].id)
  }, [entities, entityId])

  useEffect(() => {
    setBankProfileId('')
  }, [entityId])

  useEffect(() => {
    const filtered = bankProfiles.filter(b => b.entity_id === entityId)
    if (filtered.length) {
      const def = filtered.find(b => b.is_default) ?? filtered[0]
      setBankProfileId(def.id)
    }
  }, [bankProfiles, entityId])

  useEffect(() => {
    if (contacts.length && !contactId) {
      const def = contacts.find(c => c.is_default) ?? contacts[0]
      setContactId(def.id)
    }
  }, [contacts, contactId])

  const filteredBankProfiles = bankProfiles.filter(b => b.entity_id === entityId)
  const canProceed = entityId && bankProfileId && clientId && contactId && contractDate

  const handleNext = () => {
    const entity      = entities.find(e => e.id === entityId)
    const bankProfile = filteredBankProfiles.find(b => b.id === bankProfileId)
    const client      = clients.find(c => c.id === clientId)
    const contact     = contacts.find(c => c.id === contactId)
    if (!entity || !bankProfile || !client || !contact) return

    const saleUnitPrice = extracted.frigoUnitPrice * 1.1
    const { saleTotal, prepaymentAmount, balanceAmount } = calculateFinancials(
      extracted.quantityTons, saleUnitPrice, extracted.frigoTotal, 0, 0, 0
    )
    // Prepayment due 7 days after the chosen contract date (not "today").
    const contractDateObj = new Date(contractDate)
    const prepaymentDate = format(
      new Date(contractDateObj.getTime() + 7 * 24 * 60 * 60 * 1000), 'MMM/dd/yyyy'
    ).toUpperCase()

    onComplete({
      entityId: entity.id,
      entityName: entity.name,
      entityCountry: entity.country,
      entityRucEin: entity.ruc_ein,
      entityAddress: entity.address,
      entityCity: entity.city,
      bankProfileId: bankProfile.id,
      intermediaryBankName: bankProfile.intermediary_bank_name,
      intermediaryBankSwift: bankProfile.intermediary_bank_swift,
      bankName: bankProfile.bank_name,
      bankSwift: bankProfile.bank_swift,
      accountNumber: bankProfile.account_number,
      araNumber: bankProfile.ara_number,
      beneficiaryName: bankProfile.beneficiary_name,
      beneficiaryAddress: bankProfile.beneficiary_address,
      field71a: bankProfile.field_71a,
      clientId: client.id,
      clientName: client.company_name,
      clientAddress: client.address,
      clientCity: client.city,
      clientCountry: client.country,
      contactId: contact.id,
      contactPerson: contact.full_name,
      contactPhone: contact.phone,
      contactEmail: contact.email,
      contractDate, // admin-selected date from the picker below

      frigoContractRef: extracted.contractRef,
      quantityTons: extracted.quantityTons,
      productDescription: extracted.productDescription,
      frigoUnitPrice: extracted.frigoUnitPrice,
      frigoTotal: extracted.frigoTotal,
      saleUnitPrice,
      saleTotal,
      freightCost: 0,
      insuranceCost: 0,
      bankFees: 0,
      prepaymentDate,
      prepaymentAmount,
      balanceAmount,
      observations: extracted.obsClause,
      brand: extracted.brand,
      validity: extracted.validity,
      temperature: extracted.temperature,
      packing: extracted.packing,
      plantNo: extracted.plantNo,
      shipmentsDate: extracted.shipmentsDate,
      origin: extracted.origin,
      destination: extracted.destination,
      freightCondition: extracted.freightCondition,
      incoterm: extracted.incoterm,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Contract Setup</h2>
        <p className="mt-1 text-sm text-gray-500">
          Select the acting entity, client, and contact for this contract.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Acting Entity" required>
          <Select value={entityId} onChange={e => setEntityId(e.target.value)}>
            <option value="">Select entity...</option>
            {entities.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </Select>
        </FormField>

        <FormField label="Banking Profile" required>
          <Select value={bankProfileId} onChange={e => setBankProfileId(e.target.value)} disabled={!entityId}>
            <option value="">Select banking profile...</option>
            {filteredBankProfiles.map(b => (
              <option key={b.id} value={b.id}>
                {b.profile_name}{b.is_default ? ' (Default)' : ''}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Client / Buyer" required>
          <Select value={clientId} onChange={e => setClientId(e.target.value)}>
            <option value="">Select client...</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.company_name} — {c.country}</option>
            ))}
          </Select>
        </FormField>

        <FormField label="Contact Person" required>
          <Select value={contactId} onChange={e => setContactId(e.target.value)}>
            <option value="">Select contact...</option>
            {contacts.map(c => (
              <option key={c.id} value={c.id}>
                {c.full_name}{c.is_default ? ' (Default)' : ''}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Contract Date" required>
          <Input
            type="date"
            value={contractDate}
            onChange={e => setContractDate(e.target.value)}
          />
        </FormField>
      </div>

      <div className="flex justify-between pt-4 border-t border-gray-100">
        <button type="button" onClick={onBack}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          Back
        </button>
        <button type="button" onClick={handleNext} disabled={!canProceed}
          className="rounded-xl bg-brand-600 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
          Continue
        </button>
      </div>
    </div>
  )
}
