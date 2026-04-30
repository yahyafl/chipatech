// Locate every horizontal stroke (table border) in the source PDF so we
// can stop our white blocks from erasing them. Reads the page content
// stream + every form XObject, parses path operators, and prints the
// y-positions of horizontal segments.

import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pdfLibPath = resolve(__dirname, '..', 'node_modules', 'pdf-lib', 'cjs', 'index.js')
const pdfLib = await import(pathToFileURL(pdfLibPath).href).then((m) => m.default ?? m)
const { PDFDocument, PDFName, PDFArray, PDFStream, PDFRef } = pdfLib

const zlib = await import('node:zlib')

const pdfPath = process.argv[2]
if (!pdfPath) { console.error('usage'); process.exit(1) }

const buf = readFileSync(pdfPath)
const doc = await PDFDocument.load(buf, { ignoreEncryption: true })
const page = doc.getPages()[0]

async function decode(stream) {
  const raw = stream.getContents()
  const head = new TextDecoder('latin1').decode(raw.slice(0, 200))
  const isBinary = /[\x00-\x08\x0E-\x1F]/.test(head)
  if (!isBinary) return raw
  try { return zlib.inflateSync(Buffer.from(raw)) } catch { return raw }
}

// Walk a content stream and collect all stroked horizontal lines.
function findHorizontalLines(text, originX = 0, originY = 0, scale = 1) {
  const lines = [] // { y, x0, x1 }
  // We track the current cm (current transformation matrix) — simplified
  // to a translation only because Frigo's source uses identity scale on
  // its `1 0 0 1 tx ty cm` operators.
  // Tokenize by whitespace
  const tokens = text.split(/\s+/).filter(Boolean)
  let cmTx = originX, cmTy = originY
  const stack = []
  let curX = 0, curY = 0
  const segments = []

  function pushSegment(x0, y0, x1, y1) {
    if (Math.abs(y0 - y1) < 0.1) {
      segments.push({ kind: 'h', y: y0 + cmTy, x0: Math.min(x0, x1) + cmTx, x1: Math.max(x0, x1) + cmTx })
    } else if (Math.abs(x0 - x1) < 0.1) {
      segments.push({ kind: 'v', x: x0 + cmTx, y0: Math.min(y0, y1) + cmTy, y1: Math.max(y0, y1) + cmTy })
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t === 'q') { stack.push({ tx: cmTx, ty: cmTy }) }
    else if (t === 'Q') { const s = stack.pop(); if (s) { cmTx = s.tx; cmTy = s.ty } }
    else if (t === 'cm') {
      // Previous 6 numbers: a b c d e f
      const f = parseFloat(tokens[i - 1])
      const e = parseFloat(tokens[i - 2])
      cmTx += e
      cmTy += f
    }
    else if (t === 'm') {
      curY = parseFloat(tokens[i - 1])
      curX = parseFloat(tokens[i - 2])
    }
    else if (t === 'l') {
      const ny = parseFloat(tokens[i - 1])
      const nx = parseFloat(tokens[i - 2])
      pushSegment(curX, curY, nx, ny)
      curX = nx; curY = ny
    }
    else if (t === 'S' || t === 's') {
      // Stroke — confirm segments
      for (const s of segments) lines.push(s)
      segments.length = 0
    }
    else if (t === 'f' || t === 'F' || t === 'f*' || t === 'B' || t === 'b') {
      // Fill — these are filled rectangles, not borders. Skip but clear segs.
      segments.length = 0
    }
    else if (t === 'n') {
      segments.length = 0 // no-op path
    }
  }
  return lines
}

const pageDict = page.node
const contents = pageDict.get(PDFName.of('Contents'))
let text = ''
if (contents instanceof PDFArray) {
  for (let i = 0; i < contents.size(); i++) {
    const ref = contents.get(i)
    const stream = doc.context.lookup(ref)
    if (stream instanceof PDFStream) {
      const bytes = await decode(stream)
      text += new TextDecoder('latin1').decode(bytes)
    }
  }
} else {
  const stream = doc.context.lookup(contents)
  if (stream instanceof PDFStream) {
    const bytes = await decode(stream)
    text = new TextDecoder('latin1').decode(bytes)
  }
}

const lines = findHorizontalLines(text)
const horiz = lines.filter((l) => l.kind === 'h')
const vert = lines.filter((l) => l.kind === 'v')

const byY = new Map()
for (const ln of horiz) {
  const k = Math.round(ln.y * 10) / 10
  if (!byY.has(k)) byY.set(k, [])
  byY.get(k).push(ln)
}
const sortedH = [...byY.entries()].sort((a, b) => b[0] - a[0])
console.log(`Horizontal lines: ${horiz.length} segments at ${byY.size} distinct y\n`)
console.log('   y  | count | x range')
console.log('------|-------|--------------------')
for (const [y, segs] of sortedH) {
  const minX = Math.min(...segs.map((s) => s.x0))
  const maxX = Math.max(...segs.map((s) => s.x1))
  console.log(`${String(y).padStart(6)} | ${String(segs.length).padStart(5)} | ${minX.toFixed(1)} → ${maxX.toFixed(1)}`)
}

const byX = new Map()
for (const ln of vert) {
  const k = Math.round(ln.x * 10) / 10
  if (!byX.has(k)) byX.set(k, [])
  byX.get(k).push(ln)
}
const sortedV = [...byX.entries()].sort((a, b) => a[0] - b[0])
console.log(`\nVertical lines: ${vert.length} segments at ${byX.size} distinct x\n`)
console.log('   x  | count | y range')
console.log('------|-------|--------------------')
for (const [x, segs] of sortedV) {
  const minY = Math.min(...segs.map((s) => s.y0))
  const maxY = Math.max(...segs.map((s) => s.y1))
  console.log(`${String(x).padStart(6)} | ${String(segs.length).padStart(5)} | ${minY.toFixed(1)} → ${maxY.toFixed(1)}`)
}
