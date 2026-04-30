import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { ContractGenerationData } from '@/types'
import { format } from 'date-fns'

// ── Coordinate map ──────────────────────────────────────────────────────────
//
// Every entry below maps onto the EXACT text baseline of the corresponding
// field in the Frigorífico Concepción 701-2026 A4 portrait template
// (page = 595 × 842 pts, origin bottom-left).
//
// Baselines were extracted with `scripts/extract-pdf-positions.mjs` (uses
// pdfjs to read the source content stream). Do NOT eyeball values — re-run
// that script against the canonical source PDF and copy the y/x columns.
//
// Geometry, applied automatically below:
//   white rect = (x, y - 2)  size  (w, fontSize + 4)
//   text       = (x, y) baseline   right-aligned if `align: 'right'`
//
// h-padding of 4pt covers ascender top + descender bottom for any size up
// to ~10pt — which is the largest font we draw.

interface Coord {
  x: number
  y: number              // text baseline in pdf-lib coords (bottom-up)
  w: number              // white rectangle width — must cover original AND replacement
  size?: number          // font size, default 8
  bold?: boolean
  align?: 'left' | 'right'
  // Override for the white-block height (default = size + 4). Used where
  // the default would erase a Frigo template border — the block is shrunk
  // just enough to keep the border visible while still covering the
  // ascender/descender of the original text.
  blockH?: number
}

const COORDS = {
  // ── Top-left exporter block (rows: name, RUC, address, city, country)
  exporterName:    { x: 74, y: 741.52, w: 270, bold: true },
  exporterRuc:     { x: 74, y: 732.52, w: 270 },
  exporterAddress: { x: 74, y: 723.52, w: 270 },
  exporterCity:    { x: 74, y: 714.52, w: 270 },
  exporterCountry: { x: 74, y: 703.52, w: 270 },

  // ── Top-right header. Only dateOfIssue is overlaid in production —
  //    Sales Person / Assistant / Email rows belong to Frigo's internal
  //    team and stay as-is. Width 160 keeps the block end at 567 so it
  //    doesn't cross the right-edge page border at x=575.
  //    salesPerson / salesAssistant / email entries are kept here only so
  //    the calibration overlay can still draw their boxes for reference.
  salesPerson:    { x: 407, y: 741.52, w: 160 },
  salesAssistant: { x: 407, y: 732.52, w: 160 },
  dateOfIssue:    { x: 407, y: 722.52, w: 160 },
  email:          { x: 407, y: 701.52, w: 160 },

  // ── Mid-left client/buyer block. clientName uses a 10pt-tall block
  //    (instead of the default 12) so its top sits at 698.52 — JUST below
  //    the section-separator border at y=699 between Exporter and Client.
  clientName:    { x: 74, y: 690.52, w: 270, bold: true, blockH: 10 },
  clientAddress: { x: 74, y: 679.52, w: 270 },
  clientCity:    { x: 74, y: 669.52, w: 270 },
  clientCountry: { x: 74, y: 659.52, w: 270 },

  // ── Mid-right contact block. Source x's vary by 1pt per row (418 / 417 /
  //    419) so we use a single x=418 left edge that covers all. Width 155
  //    keeps the block end at 573 so it doesn't erase the right-edge page
  //    border at x=575. contactPerson also needs blockH=10 (same as
  //    clientName below) so its top stays under the y=699 section divider.
  contactPerson: { x: 418, y: 690.52, w: 155, blockH: 10 },
  contactPhone:  { x: 418, y: 680.52, w: 155 },
  contactEmail:  { x: 418, y: 670.52, w: 155 },

  // ── Payer block. Note the two "Country of origin" rows have their values
  //    indented to x=165 (after the very long label), NOT x=74.
  payerName:     { x: 74,  y: 636.52, w: 270 },
  payerCountry:  { x: 165, y: 627.69, w: 80 },
  payerCountry2: { x: 165, y: 618.69, w: 80 },

  // ── Products table (right-aligned within the column).
  //    Column dividers in the source:
  //      - x=430 (full height y=383-593) ← Description ↔ Unitary Price
  //      - x=496 (full height y=383-593) ← Unitary Price ↔ Total U$
  //      - x=495 (partial y=544-556)
  //    Block placement (must not cross any divider in its y range):
  //    - unitaryPrice: x=432 (skip x=430) → x=495 (touch x=496 boundary)
  //    - totalAmount / grandTotal: start x=498 (skip x=496 divider) and
  //      span 72pt — wide enough to fit "USD 62,370.00" at 9pt without
  //      ellipsis truncation, ending x=570 (well clear of x=575 page edge)
  //    - grandTotal blockH=9 (default would be 13) so block top sits at
  //      y=554.24 and doesn't erase the row border at y=556
  unitaryPrice: { x: 432, y: 559.74, w: 63, size: 9, bold: true, align: 'right' as const },
  totalAmount:  { x: 498, y: 559.74, w: 72, size: 9, bold: true, align: 'right' as const },
  grandTotal:   { x: 498, y: 547.24, w: 72, size: 9, bold: true, align: 'right' as const, blockH: 9 },

  // ── Specs block — only Prepayment + Balance get rewritten (per spec §7.2
  //    everything else is a pure mirror).
  prepaymentCondition: { x: 104, y: 272.52, w: 240 },
  balanceCondition:    { x: 104, y: 263.52, w: 240 },

  // ── Costs (right-side specs row). Source has TWO 0,00 columns per row at
  //    x=431 and x=501. We replace the first one only — the second 0,00
  //    stays as-is to preserve Frigo's two-column layout.
  freightCost:   { x: 425, y: 328.11, w: 60, align: 'left' as const },
  insuranceCost: { x: 425, y: 319.11, w: 60, align: 'left' as const },

  // ── Banking block. Values start at x=104 (NOT 130 like the old code
  //    used). CITIBANK NA in source is 9pt bold — we keep that for the
  //    intermediary name but everything else is 8pt bold.
  intermediaryBankName:  { x: 104, y: 226.58, w: 240, size: 9, bold: true },
  intermediaryBankSwift: { x: 104, y: 217.52, w: 240, bold: true },
  // The intermediary bank's city line (e.g. "NEW YORK, USA") sits two rows
  // below the swift. We just clear it — `data` doesn't carry a separate
  // city, and including it inline in the bank name keeps the layout simple.
  intermediaryBankCity:  { x: 104, y: 197.52, w: 240, bold: true },
  bankName:              { x: 104, y: 176.52, w: 240, bold: true },
  bankSwift:             { x: 104, y: 166.52, w: 240, bold: true },
  accountNumber:         { x: 104, y: 155.52, w: 240, bold: true },
  // Beneficiary is a TWO-LINE field in the source. We draw the new
  // beneficiary on line 1 and clear the "DELCHACO" continuation on line 2
  // — otherwise the old word leaks through.
  beneficiaryLine1:      { x: 104, y: 135.52, w: 240, bold: true },
  beneficiaryLine2:      { x: 104, y: 126.34, w: 240, bold: true },

  // ── Buyer signature footer (CHIPA TECH E.A.S. cell, 10pt bold).
  //    blockH=10 (instead of default 14) keeps block top at y=76.46 so
  //    it doesn't erase the signature divider line at y=78.
  buyerEntityName: { x: 415, y: 68.46, w: 160, size: 10, bold: true, align: 'left' as const, blockH: 10 },
} satisfies Record<string, Coord>

type CoordKey = keyof typeof COORDS

interface OverlayField {
  coord: CoordKey
  value: string
}

function formatCurrencyPDF(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** Split "{name}  ADDRESS: {addr}" across the two beneficiary rows so the
 *  long address wraps onto line 2 instead of being truncated with "…". */
function splitBeneficiary(name: string, address: string): OverlayField[] {
  const trimmedAddr = address.trim()
  const commaIdx = trimmedAddr.indexOf(',')
  let line1: string
  let line2: string
  if (commaIdx > 0) {
    line1 = `${name}  ADDRESS: ${trimmedAddr.slice(0, commaIdx)}`
    line2 = trimmedAddr.slice(commaIdx + 1).trim()
  } else {
    line1 = `${name}  ADDRESS: ${trimmedAddr}`
    line2 = ''
  }
  return [
    { coord: 'beneficiaryLine1', value: line1 },
    { coord: 'beneficiaryLine2', value: line2 },
  ]
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

// ── Debug toggle ──
// Set this true (or pass debug=true to generateMirroredContract) to draw
// red outlines + coord labels around every overlay so misalignments are
// immediately visible. Leave false for production output.
const DEBUG_PDF_OVERLAY = false

export async function generateMirroredContract(
  sourceBuffer: ArrayBuffer,
  data: ContractGenerationData,
  options: { debug?: boolean } = {}
): Promise<Uint8Array> {
  const debug = options.debug ?? DEBUG_PDF_OVERLAY
  const pdfDoc = await PDFDocument.load(sourceBuffer, { ignoreEncryption: true })
  const pages = pdfDoc.getPages()
  const page = pages[0]

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const prepaymentText = `50% until ${data.prepaymentDate} - Advanced value: USD ${formatCurrencyPDF(data.prepaymentAmount)}`
  const balanceText = `50% TT AGAINST COPY OF BL BY EMAIL`

  // The Frigo template uses ALL CAPS for every company / address / banking /
  // location value (FRIGORIFICO CONCEPCION S.A, KM 6,5 CAMINO AEROPUERTO,
  // CITIBANK NA, etc.) and mixed-case only for personal contact rows
  // (Ali Kanso, ali@chipafarm.com). Mirroring that convention keeps the
  // generated document looking like a Frigo contract instead of a patched
  // form — see "make it natural" feedback round.
  const U = (s: string) => (s ?? '').toUpperCase()

  const fields: OverlayField[] = [
    // Exporter (our entity) — uppercased to match Frigo's column convention
    { coord: 'exporterName',    value: U(data.entityName) },
    { coord: 'exporterRuc',     value: `RUC/EIN: ${U(data.entityRucEin)}` },
    { coord: 'exporterAddress', value: U(data.entityAddress) },
    { coord: 'exporterCity',    value: U(data.entityCity) },
    { coord: 'exporterCountry', value: U(data.entityCountry) },

    // Right header — per PRD §7.2 row "Sales Person / Exporter": the
    // entire top-right block (Sales Person / Sales Assistant / Date of
    // Issue / Email) is white-blocked and the hardcoded supplier name
    // "FRIGORIFICO CONCEPCION S.A." is injected as the Sales Person.
    // Sales Assistant and Email rows are blanked (white-block, no inject)
    // because the spec doesn't carry replacement values for them. Date of
    // Issue is the mirror's contract date.
    { coord: 'salesPerson',    value: 'FRIGORIFICO CONCEPCION S.A.' },
    { coord: 'salesAssistant', value: '' },
    { coord: 'dateOfIssue',    value: format(new Date(data.contractDate), 'MMMM dd/yyyy').toUpperCase() },
    { coord: 'email',          value: '' },

    // Client / Buyer — uppercased
    { coord: 'clientName',    value: U(data.clientName) },
    { coord: 'clientAddress', value: U(data.clientAddress) },
    { coord: 'clientCity',    value: U(data.clientCity) },
    { coord: 'clientCountry', value: U(data.clientCountry) },

    // Contact — keep original case (matches Frigo: "Ali Kanso", emails)
    { coord: 'contactPerson', value: data.contactPerson },
    { coord: 'contactPhone',  value: data.contactPhone },
    { coord: 'contactEmail',  value: data.contactEmail },

    // Payer — name mirrors the buyer (uppercased); the two "country of
    // origin" fields come from the Active Entity profile per spec §7.2.
    { coord: 'payerName',     value: U(data.clientName) },
    { coord: 'payerCountry',  value: U(data.entityCountry) },
    { coord: 'payerCountry2', value: U(data.entityCountry) },

    // Prices — right-aligned numeric cells (already in canonical USD format)
    { coord: 'unitaryPrice', value: `USD ${formatCurrencyPDF(data.saleUnitPrice)}` },
    { coord: 'totalAmount',  value: `USD ${formatCurrencyPDF(data.saleTotal)}` },
    { coord: 'grandTotal',   value: `USD ${formatCurrencyPDF(data.saleTotal)}` },

    // Payment terms — recalculated from new sale total
    { coord: 'prepaymentCondition', value: prepaymentText },
    { coord: 'balanceCondition',    value: balanceText },

    // Costs — admin-input fields only (first column; 2nd column stays as-is)
    { coord: 'freightCost',   value: data.freightCost   > 0 ? formatCurrencyPDF(data.freightCost)   : '0.00' },
    { coord: 'insuranceCost', value: data.insuranceCost > 0 ? formatCurrencyPDF(data.insuranceCost) : '0.00' },

    // Banking — uppercased to match Frigo's CITIBANK NA / BANCO NACIONAL...
    { coord: 'intermediaryBankName',  value: U(data.intermediaryBankName) },
    { coord: 'intermediaryBankSwift', value: U(data.intermediaryBankSwift) },
    { coord: 'intermediaryBankCity',  value: '' }, // clear "NEW YORK, USA"
    { coord: 'bankName',              value: U(data.bankName) },
    { coord: 'bankSwift',             value: U(data.bankSwift) },
    { coord: 'accountNumber',         value: data.accountNumber },
    // Beneficiary spans two lines in the source ("...SANTA TERESA Y AVIADORES" /
    // "DELCHACO"). We split on the first comma in the address — name + first
    // address part on line 1, the rest on line 2 — so long US addresses
    // wrap naturally instead of being truncated with "…".
    ...splitBeneficiary(U(data.beneficiaryName), U(data.beneficiaryAddress)),

    // Buyer signature — uppercased to match "CHIPA TECH E.A.S." style
    { coord: 'buyerEntityName', value: U(data.entityName) },
  ]

  // Two passes: blocks first, then text. Without this, adjacent rows (9pt
  // apart) get clipped by their neighbour's 12pt-tall block, which used to
  // cause a "strikethrough" appearance through the previous row's text.
  for (const field of fields) {
    const c = COORDS[field.coord] as Coord
    const fontSize = c.size ?? 8
    page.drawRectangle({
      x: c.x,
      y: c.y - 2,
      width: c.w,
      height: c.blockH ?? fontSize + 4,
      color: rgb(1, 1, 1),
      borderWidth: 0,
    })
  }

  for (const field of fields) {
    if (!field.value) continue
    const c = COORDS[field.coord] as Coord
    const fontSize = c.size ?? 8
    const font = c.bold ? helveticaBold : helvetica
    const align = c.align ?? 'left'
    const text = fitText(field.value, font, fontSize, c.w)
    const textWidth = font.widthOfTextAtSize(text, fontSize)
    const textX = align === 'right'
      ? c.x + c.w - textWidth - 2
      : c.x + 1
    page.drawText(text, {
      x: textX,
      y: c.y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    })
  }

  // Debug pass — draws coloured outlines + labels OVER the white blocks so
  // every overlay's exact geometry is visible. Toggle DEBUG_PDF_OVERLAY at
  // module top, or pass options.debug=true at call time.
  if (debug) {
    const debugFont = helveticaBold
    for (const field of fields) {
      const c = COORDS[field.coord] as Coord
      const fontSize = c.size ?? 8
      page.drawRectangle({
        x: c.x,
        y: c.y - 2,
        width: c.w,
        height: c.blockH ?? fontSize + 4,
        borderColor: rgb(0.9, 0.1, 0.1),
        borderWidth: 0.4,
        opacity: 0,
      })
      // Tiny coord label in the top-right corner of each box
      page.drawText(`${field.coord} (${c.x},${c.y})`, {
        x: c.x + 1,
        y: c.y + fontSize + 1,
        size: 4,
        font: debugFont,
        color: rgb(0.9, 0.1, 0.1),
      })
    }
  }

  return await pdfDoc.save()
}

// ── Calibration mode ────────────────────────────────────────────────────────
// Renders the source PDF with every COORD slot drawn as a coloured outlined
// rectangle plus its key label in 5pt bold. Use it to verify that every box
// sits exactly on top of the corresponding original-PDF text.

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

  const entries = Object.entries(COORDS) as [CoordKey, Coord][]
  entries.forEach(([key, c], idx) => {
    const color = CAL_COLORS[idx % CAL_COLORS.length]
    const fontSize = c.size ?? 8
    page.drawRectangle({
      x: c.x,
      y: c.y - 2,
      width: c.w,
      height: c.blockH ?? fontSize + 4,
      borderColor: color,
      borderWidth: 0.6,
      opacity: 0,
    })
    page.drawText(key.slice(0, 18), {
      x: c.x + 1,
      y: c.y + fontSize + 1,
      size: 5,
      font,
      color,
    })
  })

  return await pdfDoc.save()
}
