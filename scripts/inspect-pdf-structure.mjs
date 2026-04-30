// Diagnoses why pdf-lib drawRectangle calls don't cover the source text
// in the Frigo PDF. Inspects the page's resource tree for form XObjects
// and prints the content stream sequence.

import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pdfLibPath = resolve(__dirname, '..', 'node_modules', 'pdf-lib', 'cjs', 'index.js')
const pdfLib = await import(pathToFileURL(pdfLibPath).href).then((m) => m.default ?? m)
const { PDFDocument, PDFName, PDFArray, PDFRef, PDFStream } = pdfLib

const pdfPath = process.argv[2]
if (!pdfPath) { console.error('usage'); process.exit(1) }

const buf = readFileSync(pdfPath)
const doc = await PDFDocument.load(buf, { ignoreEncryption: true })
const page = doc.getPages()[0]

const pageDict = page.node
console.log('Page keys:', pageDict.keys().map((k) => k.toString()))

const resources = pageDict.Resources()
if (resources) {
  console.log('Resources keys:', resources.keys().map((k) => k.toString()))
  const xobj = resources.lookup(PDFName.of('XObject'))
  if (xobj) {
    console.log('XObject names:', xobj.keys().map((k) => k.toString()))
    for (const k of xobj.keys()) {
      const ref = xobj.get(k)
      console.log(`  ${k}: ${ref}`)
    }
  } else {
    console.log('No XObject in resources')
  }
}

const contents = pageDict.get(PDFName.of('Contents'))
console.log('\nContents type:', contents?.constructor?.name)
if (contents instanceof PDFArray) {
  console.log('Contents is PDFArray with', contents.size(), 'streams')
  for (let i = 0; i < contents.size(); i++) {
    const ref = contents.get(i)
    const stream = doc.context.lookup(ref)
    if (stream instanceof PDFStream) {
      const bytes = stream.getContents()
      console.log(`  stream[${i}]: ${bytes.length} bytes`)
    }
  }
} else {
  console.log('Contents is single stream')
}

// Decode each content stream individually (each may have its own /Filter).
async function decodeStreamBytes(streamBytes) {
  const text0 = new TextDecoder('latin1').decode(streamBytes.slice(0, 200))
  const looksBinary = /[\x00-\x08\x0E-\x1F]/.test(text0)
  if (!looksBinary) return streamBytes
  const zlib = await import('node:zlib')
  try { return zlib.inflateSync(Buffer.from(streamBytes)) } catch { return streamBytes }
}

const decodedParts = []
if (contents instanceof PDFArray) {
  console.log(`(joining ${contents.size()} streams individually)`)
  for (let i = 0; i < contents.size(); i++) {
    const ref = contents.get(i)
    const stream = doc.context.lookup(ref)
    if (stream instanceof PDFStream) {
      const part = await decodeStreamBytes(stream.getContents())
      decodedParts.push(part)
      console.log(`  stream[${i}]: raw=${stream.getContents().length} decoded=${part.length}`)
    }
  }
} else {
  const stream = doc.context.lookup(contents)
  if (stream instanceof PDFStream) {
    const part = await decodeStreamBytes(stream.getContents())
    decodedParts.push(part)
  }
}
const totalLen = decodedParts.reduce((n, p) => n + p.length, 0)
const allBytes = new Uint8Array(totalLen)
{ let off = 0; for (const p of decodedParts) { allBytes.set(p, off); off += p.length } }

if (allBytes && allBytes.length > 0) {
  const text = new TextDecoder('latin1').decode(allBytes)
  console.log(`\nDecoded length: ${allBytes.length} bytes`)
  // Print just our additions — last stream
  const lastPart = decodedParts[decodedParts.length - 1]
  if (lastPart) {
    const lastText = new TextDecoder('latin1').decode(lastPart)
    console.log('\n--- LAST stream (our additions) first 800 chars ---')
    console.log(lastText.slice(0, 800))
  }
  console.log('\n--- First 600 chars ---')
  console.log(text.slice(0, 600))
  console.log('\n--- Last 600 chars ---')
  console.log(text.slice(-600))

  const reMatches = text.match(/\bre\b/g) ?? []
  const fillMatches = text.match(/\b[Ff]\*?\b/g) ?? []
  const tjMatches = text.match(/\b(Tj|TJ)\b/g) ?? []
  const doMatches = text.match(/\bDo\b/g) ?? []
  console.log(`\nrectangle ops (re): ${reMatches.length}`)
  console.log(`fill ops (f/F/f*): ${fillMatches.length}`)
  console.log(`text show ops (Tj/TJ): ${tjMatches.length}`)
  console.log(`xobject draw ops (Do): ${doMatches.length}`)

  // For our generated output: find where our additions start. Our overlay
  // appends operators AFTER the source content. Show transitions to verify
  // our white rects + text come AFTER the original Tj operators.
  const lastTjIdx = text.lastIndexOf(' Tj')
  const lastTJIdx = text.lastIndexOf(' TJ')
  const lastTextIdx = Math.max(lastTjIdx, lastTJIdx)
  const firstReIdx = text.indexOf(' re ')
  console.log(`\nLast Tj/TJ at offset: ${lastTextIdx}`)
  console.log(`First 're' (rectangle) at offset: ${firstReIdx}`)
  if (firstReIdx >= 0 && lastTextIdx >= 0) {
    console.log(firstReIdx > lastTextIdx
      ? '✓ rectangles come AFTER all text — would render on top'
      : '✗ rectangles appear BEFORE some text — text will draw on top of white blocks')
  }
}

// Also inspect /Fm0 form XObject if present
const xobj0 = resources?.lookup(PDFName.of('XObject'))
const fm0 = xobj0?.lookup(PDFName.of('Fm0'))
if (fm0 instanceof PDFStream) {
  const fmBytes = fm0.getContents()
  const zlib = await import('node:zlib')
  let fmDecoded = fmBytes
  try {
    fmDecoded = zlib.inflateSync(Buffer.from(fmBytes))
  } catch {}
  const fmText = new TextDecoder('latin1').decode(fmDecoded)
  console.log(`\n=== /Fm0 form XObject (${fmDecoded.length} decoded bytes) ===`)
  console.log('First 400 chars:', fmText.slice(0, 400))
  const fmTj = fmText.match(/\b(Tj|TJ)\b/g) ?? []
  console.log(`/Fm0 text show ops: ${fmTj.length}`)
}

