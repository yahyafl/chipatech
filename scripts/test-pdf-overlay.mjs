// Generates two test artefacts from the Frigo source PDF:
//   1. test-output.pdf      — the mirrored contract with sample data
//   2. test-calibration.pdf — every COORD slot outlined in colour (debug)
//
// Usage: node scripts/test-pdf-overlay.mjs "<source.pdf>"
// Outputs land in /tmp/.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load the compiled module by transpiling on the fly via tsx isn't great
// here — instead we replicate the overlay logic by importing pdf-lib
// directly and re-using the COORDS we just defined. To stay DRY, we ship
// a thin runner that imports pdfGenerator's compiled output. If the build
// hasn't been run, fall back to a stripped-down inline runner.

const pdfPath = process.argv[2]
if (!pdfPath) {
  console.error('Usage: node test-pdf-overlay.mjs <source.pdf>')
  process.exit(1)
}

const sourceBuffer = readFileSync(pdfPath)
const arrayBuffer = sourceBuffer.buffer.slice(
  sourceBuffer.byteOffset,
  sourceBuffer.byteOffset + sourceBuffer.byteLength,
)

const pdfLibPath = resolve(__dirname, '..', 'node_modules', 'pdf-lib', 'cjs', 'index.js')
const { PDFDocument, rgb, StandardFonts } = await import(pathToFileURL(pdfLibPath).href).then((m) => m.default ?? m)

// Mirror the COORDS table from src/lib/pdfGenerator.ts. Keep this in sync —
// it's a test scaffold, not production code.
const COORDS = {
  exporterName:    { x: 74, y: 741.52, w: 270, bold: true },
  exporterRuc:     { x: 74, y: 732.52, w: 270 },
  exporterAddress: { x: 74, y: 723.52, w: 270 },
  exporterCity:    { x: 74, y: 714.52, w: 270 },
  exporterCountry: { x: 74, y: 703.52, w: 270 },
  salesPerson:    { x: 407, y: 741.52, w: 165 },
  salesAssistant: { x: 407, y: 732.52, w: 165 },
  dateOfIssue:    { x: 407, y: 722.52, w: 165 },
  email:          { x: 407, y: 701.52, w: 165 },
  clientName:    { x: 74, y: 690.52, w: 270, bold: true, blockH: 10 },
  clientAddress: { x: 74, y: 679.52, w: 270 },
  clientCity:    { x: 74, y: 669.52, w: 270 },
  clientCountry: { x: 74, y: 659.52, w: 270 },
  contactPerson: { x: 418, y: 690.52, w: 155, blockH: 10 },
  contactPhone:  { x: 418, y: 680.52, w: 155 },
  contactEmail:  { x: 418, y: 670.52, w: 155 },
  payerName:     { x: 74,  y: 636.52, w: 270 },
  payerCountry:  { x: 165, y: 627.69, w: 80 },
  payerCountry2: { x: 165, y: 618.69, w: 80 },
  unitaryPrice: { x: 432, y: 559.74, w: 63, size: 9, bold: true, align: 'right' },
  totalAmount:  { x: 498, y: 559.74, w: 72, size: 9, bold: true, align: 'right' },
  grandTotal:   { x: 498, y: 547.24, w: 72, size: 9, bold: true, align: 'right', blockH: 9 },
  prepaymentCondition: { x: 104, y: 272.52, w: 240 },
  balanceCondition:    { x: 104, y: 263.52, w: 240 },
  freightCost:   { x: 425, y: 328.11, w: 60 },
  insuranceCost: { x: 425, y: 319.11, w: 60 },
  intermediaryBankName:  { x: 104, y: 226.58, w: 240, size: 9, bold: true },
  intermediaryBankSwift: { x: 104, y: 217.52, w: 240, bold: true },
  intermediaryBankCity:  { x: 104, y: 197.52, w: 240, bold: true },
  bankName:              { x: 104, y: 176.52, w: 240, bold: true },
  bankSwift:             { x: 104, y: 166.52, w: 240, bold: true },
  accountNumber:         { x: 104, y: 155.52, w: 240, bold: true },
  beneficiaryLine1:      { x: 104, y: 135.52, w: 240, bold: true },
  beneficiaryLine2:      { x: 104, y: 126.34, w: 240, bold: true },
  buyerEntityName: { x: 415, y: 68.46, w: 160, size: 10, bold: true, blockH: 10 },
}

const sample = {
  entityName: 'Chipa Farm LLC',
  entityRucEin: 'EIN-TBD',
  entityAddress: '30 N Gould St Ste R',
  entityCity: 'Sheridan, WY 82801',
  entityCountry: 'USA',
  clientName: 'Gulf Prime Foods LLC',
  clientAddress: 'King Fahad District',
  clientCity: 'Riyadh',
  clientCountry: 'Saudi Arabia',
  contactPerson: 'Ali Kanso',
  contactPhone: '+20 1017299515',
  contactEmail: 'ali@chipafarm.com',
  contractDate: '2026-04-30',
  saleUnitPrice: 2310,
  saleTotal: 62370,
  freightCost: 0,
  insuranceCost: 0,
  prepaymentDate: 'MAY/07/2026',
  prepaymentAmount: 31185,
  intermediaryBankName: 'JPMORGAN CHASE BANK NA',
  intermediaryBankSwift: 'CHASUS33',
  bankName: 'JPMORGAN CHASE BANK NA',
  bankSwift: 'CHASUS33',
  accountNumber: '987654321',
  beneficiaryName: 'CHIPA FARM LLC',
  beneficiaryAddress: '30 N GOULD ST STE R, SHERIDAN WY 82801, USA',
}

function fitText(text, font, fontSize, maxWidth) {
  if (!text) return ''
  let t = text
  while (font.widthOfTextAtSize(t, fontSize) > maxWidth - 2 && t.length > 2) {
    t = t.slice(0, -1)
  }
  if (t !== text) t = t.slice(0, -1) + '…'
  return t
}

function fmt(amount) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

function splitBeneficiary(name, address) {
  const trimmed = address.trim()
  const idx = trimmed.indexOf(',')
  if (idx > 0) {
    return [
      ['beneficiaryLine1', `${name}  ADDRESS: ${trimmed.slice(0, idx)}`],
      ['beneficiaryLine2', trimmed.slice(idx + 1).trim()],
    ]
  }
  return [
    ['beneficiaryLine1', `${name}  ADDRESS: ${trimmed}`],
    ['beneficiaryLine2', ''],
  ]
}

async function makeOutput(debug) {
  const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  const page = doc.getPages()[0]
  const helv = await doc.embedFont(StandardFonts.Helvetica)
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const U = (s) => (s ?? '').toUpperCase()
  const fields = [
    ['exporterName', U(sample.entityName)],
    ['exporterRuc', `RUC/EIN: ${U(sample.entityRucEin)}`],
    ['exporterAddress', U(sample.entityAddress)],
    ['exporterCity', U(sample.entityCity)],
    ['exporterCountry', U(sample.entityCountry)],
    ['salesPerson', 'FRIGORIFICO CONCEPCION S.A.'],
    ['salesAssistant', ''],
    ['dateOfIssue', 'APRIL 30/2026'],
    ['email', ''],
    ['clientName', U(sample.clientName)],
    ['clientAddress', U(sample.clientAddress)],
    ['clientCity', U(sample.clientCity)],
    ['clientCountry', U(sample.clientCountry)],
    ['contactPerson', sample.contactPerson],
    ['contactPhone', sample.contactPhone],
    ['contactEmail', sample.contactEmail],
    ['payerName', U(sample.clientName)],
    ['payerCountry', U(sample.entityCountry)],
    ['payerCountry2', U(sample.entityCountry)],
    ['unitaryPrice', `USD ${fmt(sample.saleUnitPrice)}`],
    ['totalAmount', `USD ${fmt(sample.saleTotal)}`],
    ['grandTotal', `USD ${fmt(sample.saleTotal)}`],
    ['prepaymentCondition', `50% until ${sample.prepaymentDate} - Advanced value: USD ${fmt(sample.prepaymentAmount)}`],
    ['balanceCondition', '50% TT AGAINST COPY OF BL BY EMAIL'],
    ['freightCost', '0.00'],
    ['insuranceCost', '0.00'],
    ['intermediaryBankName', U(sample.intermediaryBankName)],
    ['intermediaryBankSwift', U(sample.intermediaryBankSwift)],
    ['intermediaryBankCity', ''],
    ['bankName', U(sample.bankName)],
    ['bankSwift', U(sample.bankSwift)],
    ['accountNumber', sample.accountNumber],
    ...splitBeneficiary(U(sample.beneficiaryName), U(sample.beneficiaryAddress)),
    ['buyerEntityName', U(sample.entityName)],
  ]

  // Pass 1: all white blocks
  for (const [key] of fields) {
    const c = COORDS[key]
    const fontSize = c.size ?? 8
    page.drawRectangle({
      x: c.x,
      y: c.y - 2,
      width: c.w,
      height: c.blockH ?? fontSize + 4,
      color: rgb(1, 1, 1),
    })
  }
  // Pass 2: all overlay text (drawn after all blocks → no clipping)
  for (const [key, value] of fields) {
    if (!value) continue
    const c = COORDS[key]
    const fontSize = c.size ?? 8
    const font = c.bold ? helvBold : helv
    const align = c.align ?? 'left'
    const text = fitText(value, font, fontSize, c.w)
    const tw = font.widthOfTextAtSize(text, fontSize)
    const tx = align === 'right' ? c.x + c.w - tw - 2 : c.x + 1
    page.drawText(text, { x: tx, y: c.y, size: fontSize, font, color: rgb(0, 0, 0) })
  }
  if (debug) {
    for (const [key] of fields) {
      const c = COORDS[key]
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
      page.drawText(`${key}`, {
        x: c.x + 1,
        y: c.y + fontSize + 1,
        size: 4,
        font: helvBold,
        color: rgb(0.9, 0.1, 0.1),
      })
    }
  }
  return await doc.save()
}

const outDir = resolve(__dirname, '..', 'test')
const out = await makeOutput(false)
writeFileSync(resolve(outDir, 'test-output.pdf'), out)
console.log(`✓ wrote test/test-output.pdf (${out.length} bytes)`)

const dbg = await makeOutput(true)
writeFileSync(resolve(outDir, 'test-calibration.pdf'), dbg)
console.log(`✓ wrote test/test-calibration.pdf (${dbg.length} bytes)`)
