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
  // ── Exporter block (top-left). Calibrated 2026-04: every row was 1
  //    full row too high, so y values reduced by 12pt across the block.
  exporterName:    { x: 70, y: 742, w: 230, h: 12 },
  exporterRuc:     { x: 70, y: 730, w: 230, h: 12 },
  exporterAddress: { x: 70, y: 718, w: 230, h: 12 },
  exporterCity:    { x: 70, y: 706, w: 230, h: 12 },
  exporterCountry: { x: 70, y: 694, w: 230, h: 12 },

  // ── Right-side header — calibrated 2026-04 (pass 7): email pulled
  //    down 12pt because source MARCUS@... was bleeding through one row
  //    below our white block.
  salesPerson:    { x: 350, y: 738, w: 230, h: 12 },
  salesAssistant: { x: 350, y: 726, w: 230, h: 12 },
  dateOfIssue:    { x: 350, y: 714, w: 230, h: 12 },
  email:          { x: 350, y: 678, w: 230, h: 12 },

  // ── Client / Buyer block ──────────────────────────────────────────────
  clientName:    { x: 70, y: 684, w: 230, h: 12 },
  clientAddress: { x: 70, y: 672, w: 230, h: 12 },
  clientCity:    { x: 70, y: 660, w: 230, h: 12 },
  clientCountry: { x: 70, y: 648, w: 230, h: 12 },

  // ── Contact person block (mid-right) ──────────────────────────────────
  contactPerson: { x: 350, y: 684, w: 230, h: 12 },
  contactPhone:  { x: 350, y: 672, w: 230, h: 12 },
  contactEmail:  { x: 350, y: 660, w: 230, h: 12 },

  // ── Payer block — calibrated 2026-04 (pass 4): block was one row late,
  //    payerName was landing on "Country of Origin" instead of "Payer".
  //    Shifted up 12pt to align with the actual Payer data rows.
  payerName:     { x: 70, y: 638, w: 230, h: 12 },
  payerCountry:  { x: 70, y: 626, w: 230, h: 12 },
  payerCountry2: { x: 70, y: 614, w: 230, h: 12 },

  // ── Products table (price / total cells).
  //    Calibrated 2026-04 (pass 5): pass 4 was 1 row too low — unitaryPrice
  //    landed on the "Total" row. Bumped up 12pt so it sits on the data row
  //    "27,00 ... 2.100,000 | 56.700,00", and grandTotal moved up to the
  //    Total row.
  unitaryPrice: { x: 425, y: 557, w: 78, h: 11 },
  totalAmount:  { x: 510, y: 557, w: 70, h: 11 },
  grandTotal:   { x: 510, y: 545, w: 70, h: 11 },

  // ── Specs block — Brand/Validity/Temperature/Packing/Shipment/Origin/
  //    Destination/FreightCondition are PURE MIRROR per spec §7.2.
  //    Only Prepayment + Balance get rewritten with new amounts.
  //    Calibrated 2026-04 (pass 6): pass 5 was 1 row too low — boxes
  //    landed on "Balance Condition" / "Law and Jurisdiction" rows.
  //    Bumped up 12pt to sit on the actual Prepayment / Balance rows.
  prepaymentCondition: { x: 130, y: 272, w: 175, h: 11 },
  balanceCondition:    { x: 130, y: 260, w: 175, h: 11 },

  // ── Costs (right-side specs row) — admin-input only.
  //    Calibrated 2026-04 (pass 4): pass 3 was still 1-2 rows too low,
  //    boxes were sitting near "Freight Condition PREPAID" instead of on
  //    the actual Freight cost / Insurance cost data rows.
  freightCost:   { x: 405, y: 320, w: 65, h: 11 },
  insuranceCost: { x: 405, y: 308, w: 65, h: 11 },

  // ── Banking block — calibrated 2026-04 (pass 7): every bank row was
  //    ~60pt below its target — values were landing in the QR/signature
  //    area while the original Frigo bank info was leaking through above.
  //    Shifted up 60pt to land on the actual BENEFICIARY'S BANK rows.
  intermediaryBankName:  { x: 130, y: 216, w: 175, h: 11 },
  intermediaryBankSwift: { x: 130, y: 204, w: 175, h: 11 },
  bankName:              { x: 130, y: 176, w: 175, h: 11 },
  bankSwift:             { x: 130, y: 164, w: 175, h: 11 },
  accountNumber:         { x: 130, y: 152, w: 175, h: 11 },
  beneficiaryName:       { x: 85,  y: 130, w: 460, h: 11 },

  // ── Buyer signature ────────────────────────────────────────────────────
  buyerEntityName: { x: 380, y: 38, w: 195, h: 11 },
}

type CoordKey = keyof typeof COORDS

interface OverlayField {
  coord: CoordKey
  value: string
  fontSize?: number
  bold?: boolean
  align?: 'left' | 'right' // default 'left' — use 'right' for numeric cells
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

    // Payer — name mirrors the buyer, but the two "country of origin"
    // fields come from the Active Entity profile (per spec §7.2).
    { coord: 'payerName',     value: data.clientName },
    { coord: 'payerCountry',  value: data.entityCountry },
    { coord: 'payerCountry2', value: data.entityCountry },

    // Prices — numeric cells, right-aligned to match Frigo's column layout
    { coord: 'unitaryPrice', value: `USD ${formatCurrencyPDF(data.saleUnitPrice)}`, bold: true, align: 'right' },
    { coord: 'totalAmount',  value: `USD ${formatCurrencyPDF(data.saleTotal)}`,     bold: true, align: 'right' },
    { coord: 'grandTotal',   value: `USD ${formatCurrencyPDF(data.saleTotal)}`,     bold: true, align: 'right' },

    // Payment terms — recalculated from new sale total
    { coord: 'prepaymentCondition', value: prepaymentText },
    { coord: 'balanceCondition',    value: balanceText },

    // Costs — admin-input fields only
    { coord: 'freightCost',   value: data.freightCost   > 0 ? formatCurrencyPDF(data.freightCost)   : '0.00' },
    { coord: 'insuranceCost', value: data.insuranceCost > 0 ? formatCurrencyPDF(data.insuranceCost) : '0.00' },

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
    // 8pt matches the Helvetica body text used by the Frigo template.
    // Bigger feels patched-on, smaller feels squashed below the row.
    const fontSize = field.fontSize ?? 8
    const font = field.bold ? helveticaBold : helvetica

    // White cover rectangle — extends 1pt below baseline to hide
    // descenders, and 1pt above to hide ascender tops. Without this
    // bleed-margin source text fragments leak through the patch.
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
      const textWidth = font.widthOfTextAtSize(text, fontSize)
      // Right-align numeric cells (prices) to match the original Frigo
      // layout where the column was right-aligned. Other fields stay left.
      const textX = field.align === 'right'
        ? c.x + c.w - textWidth - 2
        : c.x + 1
      // Text baseline at c.y + 2 — same as Frigo's source baselines, so
      // characters sit on the same line the original text sat on.
      page.drawText(text, {
        x: textX,
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
