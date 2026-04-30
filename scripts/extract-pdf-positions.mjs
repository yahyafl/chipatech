// Extracts every text item from the source Frigo PDF with x/y/font/size,
// converts pdfjs top-down y to pdf-lib bottom-up y, and prints sorted lines.
// Usage: node scripts/extract-pdf-positions.mjs "<absolute path to PDF>"

import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const pdfjsPath = resolve(__dirname, '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs')
const { getDocument } = await import(pathToFileURL(pdfjsPath).href)

const pdfPath = process.argv[2]
if (!pdfPath) {
  console.error('Usage: node extract-pdf-positions.mjs <pdf>')
  process.exit(1)
}

const data = new Uint8Array(readFileSync(pdfPath))
const doc = await getDocument({ data, useSystemFonts: true }).promise
const page = await doc.getPage(1)
const viewport = page.getViewport({ scale: 1 })
const pageHeight = viewport.height
const pageWidth = viewport.width

console.log(`# Page size: ${pageWidth} x ${pageHeight}`)

const tc = await page.getTextContent({ includeMarkedContent: false })

// pdfjs transform[4]=e is x (left-to-right), transform[5]=f is the
// baseline y in PDF user space (bottom-up — same convention as pdf-lib).
// "yTop" = how far from top of page (useful for visual ordering).
const items = tc.items
  .filter((it) => it.str && it.str.trim().length > 0)
  .map((it) => {
    const [, , , d, e, f] = it.transform
    const fontSize = Math.abs(d)
    return {
      x: Math.round(e * 100) / 100,
      y: Math.round(f * 100) / 100,                 // pdf-lib baseline
      yTop: Math.round((pageHeight - f) * 100) / 100,
      w: Math.round(it.width * 100) / 100,
      h: Math.round(it.height * 100) / 100,
      size: Math.round(fontSize * 100) / 100,
      font: it.fontName,
      text: it.str,
    }
  })

// Sort top→bottom (smaller yTop = higher on page) then left→right
items.sort((a, b) => a.yTop === b.yTop ? a.x - b.x : a.yTop - b.yTop)

// Print as a table — easiest to grep against
console.log('y(pdf-lib) | x      | w      | size | text')
console.log('---------- | ------ | ------ | ---- | ----')
for (const it of items) {
  console.log(`${String(it.y).padStart(10)} | ${String(it.x).padStart(6)} | ${String(it.w).padStart(6)} | ${String(it.size).padStart(4)} | ${it.text}`)
}
