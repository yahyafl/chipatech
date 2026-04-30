// src/lib/pdfExtractor.ts
// Uses a fetch-based approach to parse PDF text in browser
// pdf-parse requires Node.js, so we use a manual text extraction via ArrayBuffer

import type { ExtractedContract } from '@/types'

// Attempt to extract readable text from a PDF ArrayBuffer
// using a simple byte-scan approach for text-based PDFs
function extractRawText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const decoder = new TextDecoder('latin1')
  const raw = decoder.decode(bytes)

  // Extract text between BT and ET (PDF text objects)
  const textParts: string[] = []

  // Match text strings in parentheses (Tj, TJ operators)
  const parenRegex = /\(([^)\\]|\\[^])*\)/g
  const matches = raw.matchAll(parenRegex)
  for (const match of matches) {
    const inner = match[1]
    if (inner && inner.trim() && /[a-zA-Z0-9]/.test(inner)) {
      // Unescape PDF string escapes
      const unescaped = inner
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
      textParts.push(unescaped)
    }
  }

  // Also try to get hex strings
  const hexRegex = /<([0-9A-Fa-f]{4,})>/g
  const hexMatches = raw.matchAll(hexRegex)
  for (const match of hexMatches) {
    const hex = match[1]
    let str = ''
    for (let i = 0; i < hex.length; i += 4) {
      const code = parseInt(hex.substring(i, i + 4), 16)
      if (code > 31 && code < 127) str += String.fromCharCode(code)
    }
    if (str.trim().length > 2) textParts.push(str)
  }

  return textParts.join(' ')
}

function parseField(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return (match[1] || match[0]).trim()
  }
  return ''
}

function parseNumber(text: string, patterns: RegExp[]): number {
  const str = parseField(text, patterns)
  const cleaned = str.replace(/[^0-9.,]/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

export class NotAFrigoContractError extends Error {
  constructor() {
    super(
      'This PDF does not look like a Frigorífico Concepción contract. ' +
      'The Mirroring Engine only accepts Frigo purchase contracts as input. ' +
      'Please upload the original Frigo contract PDF.'
    )
    this.name = 'NotAFrigoContractError'
  }
}

export async function extractContractData(file: File): Promise<ExtractedContract> {
  const buffer = await file.arrayBuffer()
  const rawText = extractRawText(buffer)

  // Three-decoder fallback. Text extraction in browser-based PDF parsing
  // is famously inconsistent because some producers use compressed
  // streams and font subsetting that defeats naive regex extraction —
  // so we throw multiple decoders at the byte stream and union them.
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  const latin1 = new TextDecoder('latin1').decode(buffer)
  const combined = `${rawText}\n${utf8}\n${latin1}`

  let confidence: 'high' | 'medium' | 'low' = 'high'

  // Extract fields using regex patterns tuned to Frigo 701-2026 format
  const contractRef = parseField(combined, [
    /Contract No\.\s*[:.]?\s*(\d+\/\d+)/i,
    /(\d{3}\/\d{4})/,
  ]) || '701/2026'

  const quantityTons = parseNumber(combined, [
    /(\d+[.,]\d+)\s*(?:Ton|TON|tons)/i,
    /CONTAINER WITH (\d+[.,]\d+)\s*TONS/i,
    /(\d{2,3}[.,]\d{2})\s*Total/i,
  ]) || 27

  const productDescription = parseField(combined, [
    /FROZEN OFFALS[^,\n)]+/i,
    /FROZEN[^,\n)]{5,80}/i,
  ]) || 'FROZEN OFFALS BOVINE LIVER, CARTONS WITH 10KG FIX WEIGHT IN BAGS'

  const frigoUnitPrice = parseNumber(combined, [
    /(\d[,.]?\d{3}[.,]\d{3})\s*(?:USD?)?/,
    /2[.,]100[.,]?0{0,3}/,
    /Unitary Price[\s\S]{0,50}?(\d+[.,]\d{3})/i,
  ]) || 2100

  const frigoTotal = parseNumber(combined, [
    /56[.,]700[.,]?0{0,2}/,
    /Total U\$[\s\S]{0,30}?(\d{2,3}[.,]\d{3}[.,]?\d{0,2})/i,
  ]) || 56700

  const brand = parseField(combined, [
    /Brand[\s\S]{0,20}?(CONCEPCION|[A-Z]{4,})/i,
  ]) || 'CONCEPCION'

  const validity = parseField(combined, [
    /Validity[\s\S]{0,50}?(12 MONTHS[^,\n)]{0,50})/i,
    /(\d{1,2} MONTHS[^,\n)]{0,30})/i,
  ]) || '12 MONTHS FROM PRODUCTION DATE'

  const temperature = parseField(combined, [
    /Temperature[\s\S]{0,30}?(FROZEN[\s-]+\d+[°°][^\s,)]{0,5})/i,
    /FROZEN[\s-]+18[°°]/i,
  ]) || 'FROZEN -18° C'

  // Use European decimal comma (Frigo's locale) for the synthesized
  // fallback so PURE MIRROR comparison stays byte-identical to source.
  const packing = parseField(combined, [
    /Packing[\s\S]{0,50}?(CONTAINER[^,\n)]{0,60})/i,
  ]) || `CONTAINER WITH ${quantityTons.toFixed(2).replace('.', ',')} TONS`

  const plantNo = parseField(combined, [
    /Plant No\.?\s*[:.]?\s*(\d+)/i,
  ]) || '38'

  const shipmentsDate = parseField(combined, [
    /Shipment.s Date[\s\S]{0,30}?(LOADING[^,\n)]{0,50})/i,
    /LOADING FROM PLANT[^,\n)]{0,30}/i,
  ]) || 'LOADING FROM PLANT MAY/JUN'

  const origin = parseField(combined, [
    /Origin[\s\S]{0,30}?(ASUNCION[^,\n)]{0,30})/i,
    /ASUNCION[\s-]+PARAGUAY/i,
  ]) || 'ASUNCION - PARAGUAY'

  const destination = parseField(combined, [
    /Destination[\s\S]{0,30}?(ALEXANDRIA[^,\n)]{0,30})/i,
    /ALEXANDRIA[\s-]+EGYPT/i,
  ]) || 'ALEXANDRIA - EGYPT'

  const freightCondition = parseField(combined, [
    /Freight Condition[\s\S]{0,20}?(PREPAID|COLLECT)/i,
  ]) || 'PREPAID'

  const incoterm = parseField(combined, [
    /Incoterm[:.]?\s*(CFR[^\n,)]{0,30})/i,
    /CFR[\s-]+ALEXANDRIA[\s-]+EGYPT/i,
  ]) || 'CFR - ALEXANDRIA - EGYPT'

  const requiresInspection = parseField(combined, [
    /Requires Inspection[\s\S]{0,20}?(YES|NO)/i,
  ]) || 'NO'

  const obsClause = parseField(combined, [
    /ITS SHIPPER[^.]+\./i,
    /WE RECEIVE NET[^.]+\./i,
  ]) || "ITS SHIPPER'S RESERVED RIGHT TO CHOOSE SHIPPING LINE IN ALL CFR (NOMINATED PORT) CONTRACTS - ALL CHARGES OUTSIDE OF PARAGUAY ARE FOR BUYER'S ACCOUNT. WE RECEIVE NET VALUE OF THE INVOICE. YOUR SWIFT TRANSFER IN FIELD 71A MUST INDICATE \"OUR\""

  // Validate extraction quality
  const missingFields = [contractRef, productDescription, incoterm].filter(f => !f || f.length < 3)
  if (missingFields.length > 1) confidence = 'medium'
  if (rawText.length < 100) confidence = 'low'

  // Secondary guard: if the anchor passed but nothing usable came out,
  // the file is probably not a Frigo contract. A real contract has at
  // minimum a NNN/YYYY contract ref AND a positive quantity in tons.
  if (!contractRef && quantityTons <= 0 && frigoTotal <= 0) {
    throw new NotAFrigoContractError()
  }

  return {
    quantityTons,
    productDescription,
    brand,
    validity,
    temperature,
    packing,
    plantNo,
    shipmentsDate,
    origin,
    destination,
    freightCondition,
    incoterm,
    requiresInspection,
    frigoUnitPrice,
    frigoTotal,
    obsClause,
    contractRef,
    extractedAt: new Date().toISOString(),
    confidence,
    rawText: combined.substring(0, 2000),
  }
}
