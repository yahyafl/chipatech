import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { ContractGenerationData } from '@/types'
import { format } from 'date-fns'

// Coordinate map anchored to Frigo 701-2026 A4 portrait layout.
// Origin = bottom-left corner. A4 = 595 × 842 pts.
//
// READING GUIDE:
//   x, y = bottom-left corner of the white cover rectangle
//   w    = width of the rectangle (and text clipping zone)
//   h    = height of the rectangle. Each block is drawn h+1 tall so there
//          is always a 1 pt buffer above the text baseline.
//
// How to calibrate: click "Calibration PDF" in the preview step.
// Each rectangle is drawn as a coloured box labelled with its key name.
// Adjust x/y/w/h until every coloured box sits exactly on top of its
// original-PDF text, then switch back to the white overlay.
const COORDS = {
  // ── Exporter block (top-left) — data column starts AFTER labels at x≈85
  exporterName:    { x: 85, y: 750, w: 210, h: 11 },
  exporterRuc:     { x: 85, y: 738, w: 210, h: 11 },
  exporterAddress: { x: 85, y: 726, w: 210, h: 11 },
  exporterCity:    { x: 85, y: 714, w: 210, h: 11 },
  exporterCountry: { x: 85, y: 702, w: 210, h: 11 },

  // ── Right-side header (sales person / date) — data column starts at x≈360
  salesPerson:    { x: 360, y: 750, w: 215, h: 11 },
  salesAssistant: { x: 360, y: 738, w: 215, h: 11 },
  dateOfIssue:    { x: 360, y: 726, w: 215, h: 11 },
  email:          { x: 360, y: 702, w: 215, h: 11 },

  // ── Client / Buyer block ───────────────────────────────────────────────
  clientName:    { x: 85, y: 680, w: 210, h: 11 },
  clientAddress: { x: 85, y: 668, w: 210, h: 11 },
  clientCity:    { x: 85, y: 656, w: 210, h: 11 },
  clientCountry: { x: 85, y: 644, w: 210, h: 11 },

  // ── Contact person block (mid-right) ───────────────────────────────────
  contactPerson: { x: 360, y: 680, w: 215, h: 11 },
  contactPhone:  { x: 360, y: 668, w: 215, h: 11 },
  contactEmail:  { x: 360, y: 656, w: 215, h: 11 },

  // ── Payer block ────────────────────────────────────────────────────────
  payerName:     { x: 85, y: 622, w: 210, h: 11 },
  payerCountry:  { x: 85, y: 610, w: 210, h: 11 },
  payerCountry2: { x: 85, y: 598, w: 210, h: 11 },

  // ── Products table (price / total cells) ──────────────────────────────
  unitaryPrice: { x: 425, y: 525, w: 78, h: 11 },
  totalAmount:  { x: 510, y: 525, w: 70, h: 11 },
  grandTotal:   { x: 510, y: 485, w: 70, h: 11 },

  // ── Specs block (Brand/Validity/etc don't change; only ship/origin/dest)
  shipmentsDate: { x: 130, y: 252, w: 165, h: 11 },
  origin:        { x: 130, y: 240, w: 165, h: 11 },
  destination:   { x: 130, y: 228, w: 165, h: 11 },
  prepaymentCondition: { x: 130, y: 216, w: 175, h: 11 },
  balanceCondition:    { x: 130, y: 204, w: 175, h: 11 },

  // ── Costs (right-side specs row) ──────────────────────────────────────
  freightCost:      { x: 405, y: 252, w: 65, h: 11 },
  insuranceCost:    { x: 405, y: 240, w: 65, h: 11 },
  freightCondition: { x: 405, y: 228, w: 130, h: 11 },

  // ── Banking block ─────────────────────────────────────────────────────
  intermediaryBankName:  { x: 130, y: 156, w: 175, h: 11 },
  intermediaryBankSwift: { x: 130, y: 144, w: 175, h: 11 },
  bankName:              { x: 130, y: 116, w: 175, h: 11 },
  bankSwift:             { x: 130, y: 104, w: 175, h: 11 },
  accountNumber:         { x: 130, y: 92,  w: 175, h: 11 },
  beneficiaryName:       { x: 85, y: 70,   w: 220, h: 11 },

  // ── Buyer signature ────────────────────────────────────────────────────
  buyerEntityName: { x: 380, y: 38, w: 195, h: 11 },
}

type CoordKey = keyof typeof COORDS

interface OverlayField {
  coord: CoordKey
  value: string
  fontSize?: number
  bold?: boolean
}

function formatCurrencyPDF(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** Truncate text to fit within maxWidth pts at the given fontSize. */
function fitText(text: string, font: import('pdf-lib').PDFFont, fontSize: number, maxWidth: number): string {
  if (!text) return ''
  let t = text
  while (font.widthOfTextAtSize(t, fontSize) > maxWidth - 2 && t.length > 2) {
    t = t.slice(0, -1)
  }
  if (t !== text) t = t.slice(0, -1) + '…'
  return t
}

export async function generateMirroredContract(
  sourceBuffer: ArrayBuffer,
  data: ContractGenerationData
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(sourceBuffer, { ignoreEncryption: true })
  const pages = pdfDoc.getPages()
  const page = pages[0]

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const prepaymentText = `50% until ${data.prepaymentDate} - Advanced value: USD ${formatCurrencyPDF(data.prepaymentAmount)}`
  const balanceText = `50% TT AGAINST COPY OF BL BY EMAIL`

  const fields: OverlayField[] = [
    // Exporter (our entity)
    { coord: 'exporterName',    value: data.entityName,    bold: true },
    { coord: 'exporterRuc',     value: `RUC/EIN: ${data.entityRucEin}` },
    { coord: 'exporterAddress', value: data.entityAddress },
    { coord: 'exporterCity',    value: data.entityCity },
    { coord: 'exporterCountry', value: data.entityCountry },

    // Right header — keep Frigo as the "issuer" reference, update date
    { coord: 'salesPerson',    value: 'FRIGORIFICO CONCEPCION S.A.' },
    { coord: 'salesAssistant', value: '' },
    { coord: 'dateOfIssue',    value: format(new Date(data.contractDate), 'MMMM dd/yyyy').toUpperCase() },
    { coord: 'email',          value: '' },

    // Client / Buyer
    { coord: 'clientName',    value: data.clientName,    bold: true },
    { coord: 'clientAddress', value: data.clientAddress },
    { coord: 'clientCity',    value: data.clientCity },
    { coord: 'clientCountry', value: data.clientCountry },

    // Contact
    { coord: 'contactPerson', value: data.contactPerson },
    { coord: 'contactPhone',  value: data.contactPhone },
    { coord: 'contactEmail',  value: data.contactEmail },

    // Payer (mirrors buyer)
    { coord: 'payerName',     value: data.clientName },
    { coord: 'payerCountry',  value: data.clientCountry },
    { coord: 'payerCountry2', value: data.clientCountry },

    // Prices
    { coord: 'unitaryPrice', value: `USD ${formatCurrencyPDF(data.saleUnitPrice)}`, bold: true },
    { coord: 'totalAmount',  value: `USD ${formatCurrencyPDF(data.saleTotal)}`,     bold: true },
    { coord: 'grandTotal',   value: `USD ${formatCurrencyPDF(data.saleTotal)}`,     bold: true },

    // Shipment / route — data the wizard captures
    { coord: 'shipmentsDate', value: data.shipmentsDate ?? '' },
    { coord: 'origin',        value: data.origin ?? '' },
    { coord: 'destination',   value: data.destination ?? '' },

    // Payment terms
    { coord: 'prepaymentCondition', value: prepaymentText },
    { coord: 'balanceCondition',    value: balanceText },

    // Costs + freight condition (right-side specs)
    { coord: 'freightCost',      value: data.freightCost   > 0 ? formatCurrencyPDF(data.freightCost)   : '0.00' },
    { coord: 'insuranceCost',    value: data.insuranceCost > 0 ? formatCurrencyPDF(data.insuranceCost) : '0.00' },
    { coord: 'freightCondition', value: data.freightCondition ?? '' },

    // Banking
    { coord: 'intermediaryBankName',  value: data.intermediaryBankName },
    { coord: 'intermediaryBankSwift', value: data.intermediaryBankSwift },
    { coord: 'bankName',              value: data.bankName },
    { coord: 'bankSwift',             value: data.bankSwift },
    { coord: 'accountNumber',         value: data.accountNumber },
    { coord: 'beneficiaryName',       value: `${data.beneficiaryName}  ADDRESS: ${data.beneficiaryAddress}` },

    // Buyer signature
    { coord: 'buyerEntityName', value: data.entityName, bold: true },
  ]

  for (const field of fields) {
    const c = COORDS[field.coord]
    const fontSize = field.fontSize ?? 7.5
    const font = field.bold ? helveticaBold : helvetica

    // White cover rectangle — starts 1pt below the text baseline so
    // descenders are also hidden; extends h+1 pts upward from there.
    page.drawRectangle({
      x: c.x,
      y: c.y - 1,
      width: c.w,
      height: c.h + 2,
      color: rgb(1, 1, 1),
      borderWidth: 0,
    })

    if (field.value) {
      const text = fitText(field.value, font, fontSize, c.w)
      page.drawText(text, {
        x: c.x + 1,
        y: c.y + 2,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      })
    }
  }

  return await pdfDoc.save()
}

// ── Calibration mode ─────────────────────────────────────────────────────
// Draws labelled coloured rectangles over every COORD slot so you can see
// exactly where each field maps onto the original PDF.
// Download the result, compare against the source, and adjust x/y/w/h above.

const CAL_COLORS = [
  rgb(0.9, 0.1, 0.1),   // red
  rgb(0.1, 0.4, 0.9),   // blue
  rgb(0.1, 0.7, 0.2),   // green
  rgb(0.9, 0.5, 0.0),   // orange
  rgb(0.6, 0.1, 0.9),   // purple
]

export async function calibrateOverlays(sourceBuffer: ArrayBuffer): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(sourceBuffer, { ignoreEncryption: true })
  const pages = pdfDoc.getPages()
  const page = pages[0]
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const entries = Object.entries(COORDS)
  entries.forEach(([key, c], idx) => {
    const color = CAL_COLORS[idx % CAL_COLORS.length]
    // Semi-transparent fill
    page.drawRectangle({
      x: c.x, y: c.y - 1,
      width: c.w, height: c.h + 2,
      color: rgb(1, 1, 1),
      borderColor: color,
      borderWidth: 0.8,
      opacity: 0.85,
    })
    // Label (first 16 chars of key)
    page.drawText(key.slice(0, 16), {
      x: c.x + 1, y: c.y + 2,
      size: 5,
      font,
      color,
    })
  })

  return await pdfDoc.save()
}
