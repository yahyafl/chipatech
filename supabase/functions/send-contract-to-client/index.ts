// Edge Function: send-contract-to-client
//
// Manually emails the generated Sales Contract PDF to the client's contact
// email. Triggered by a super-admin pressing "Send Contract to Client" on
// the trade detail page. Spec note: PRD §11 only mandates milestone alerts
// to super-admins; this is a beyond-spec convenience to remove the
// "download → switch to email client → attach → send" manual loop.
//
// Flow:
//   1. Verify the caller is super_admin (RLS-style check via JWT)
//   2. Look up the trade, client, and the latest sales_contract document
//   3. Download the PDF bytes from storage (service-role; bypasses RLS)
//   4. Send via Resend with the PDF attached
//   5. Stamp trades.contract_sent_at + write an audit log entry

// @ts-expect-error — Deno-only import resolved at runtime by the edge runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Response | Promise<Response>): void }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => {
  if (status >= 400) console.error(`[send-contract-to-client] ${status}`, body)
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const FROM_ADDRESS = Deno.env.get('RESEND_FROM') ?? 'TradeMirror <onboarding@resend.dev>'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

function buildHtml(clientName: string, tradeRef: string, senderName: string) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f8fafc; margin:0; padding:40px 20px; }
    .card { background:#fff; border-radius:12px; max-width:560px; margin:0 auto; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.1); }
    .header { background:#0ea5e9; padding:28px 32px; }
    .header h1 { color:#fff; margin:0; font-size:22px; }
    .header p { color:#bae6fd; margin:4px 0 0; font-size:13px; }
    .body { padding:28px 32px; color:#0f172a; font-size:15px; line-height:1.6; }
    .body strong { color:#0f172a; }
    .footer { padding:20px 32px; border-top:1px solid #e2e8f0; font-size:12px; color:#94a3b8; text-align:center; }
  </style></head><body>
    <div class="card">
      <div class="header">
        <h1>Sales Contract — ${tradeRef}</h1>
        <p>Chipa Farm LLC</p>
      </div>
      <div class="body">
        Dear ${clientName},<br><br>
        Please find attached the sales contract <strong>${tradeRef}</strong> covering the cargo we discussed.<br><br>
        Kindly review the document, sign, and return a scanned copy at your earliest convenience.
        Once we have the countersigned copy, we will proceed with the production planning and shipment schedule.<br><br>
        Bank details for the 50% advance payment are listed in the attached contract under
        <em>Beneficiary's Bank</em>. The advance is due seven (7) days after the contract date.<br><br>
        If anything in the contract needs revision, just reply to this email and we will reissue.<br><br>
        Best regards,<br>
        ${senderName}<br>
        Chipa Farm LLC
      </div>
      <div class="footer">Sent automatically by TradeMirror OS &mdash; please reply to this address with any questions.</div>
    </div>
  </body></html>`
}

interface ResendAttachment {
  filename: string
  content: string // base64-encoded
}

async function sendEmail(to: string, subject: string, html: string, attachments: ResendAttachment[]) {
  if (!RESEND_API_KEY) {
    console.warn('[send-contract-to-client] RESEND_API_KEY not set — skipping')
    return { skipped: true as const }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html, attachments }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[send-contract-to-client] Resend error:', res.status, err)
      return { ok: false as const, error: err }
    }
    return { ok: true as const }
  } catch (err) {
    console.error('[send-contract-to-client] threw:', err)
    return { ok: false as const, error: String(err) }
  }
}

/** Convert binary blob to base64 (Deno-compatible). */
async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  const bytes = new Uint8Array(buf)
  // Build a binary string in chunks so we don't hit the JS call-stack limit
  // for large PDFs (apply()-based encoding tops out around 100k bytes).
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
    return json({ error: 'Missing Supabase env vars' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  const { data: { user: caller }, error: callerErr } = await supabaseAuth.auth.getUser(jwt)
  if (callerErr || !caller) return json({ error: callerErr?.message ?? 'Invalid auth token' }, 401)

  const { data: callerProfile } = await supabaseAdmin
    .from('users')
    .select('role, full_name, is_active')
    .eq('id', caller.id)
    .single()

  if (!callerProfile?.is_active) return json({ error: 'Account inactive' }, 403)
  if (callerProfile.role !== 'super_admin') {
    return json({ error: 'Only super_admin can send contracts to clients' }, 403)
  }

  let body: { trade_id?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { trade_id } = body
  if (!trade_id) return json({ error: 'Missing trade_id' }, 400)

  // Fetch trade + client + most-recent sales_contract document
  const { data: trade, error: tradeErr } = await supabaseAdmin
    .from('trades')
    .select('id, trade_reference, client:clients(company_name, contact_name, contact_email)')
    .eq('id', trade_id)
    .single()

  if (tradeErr || !trade) return json({ error: tradeErr?.message ?? 'Trade not found' }, 404)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = trade.client as any
  const recipient: string | undefined = client?.contact_email
  if (!recipient) return json({ error: 'Client has no contact email on file' }, 400)

  const { data: doc, error: docErr } = await supabaseAdmin
    .from('documents')
    .select('storage_path, file_name')
    .eq('trade_id', trade_id)
    .eq('document_type', 'sales_contract')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .single()

  if (docErr || !doc) return json({ error: 'No generated sales contract found for this trade. Generate the contract first.' }, 404)

  const { data: pdfBlob, error: dlErr } = await supabaseAdmin.storage
    .from('trade-documents')
    .download(doc.storage_path)

  if (dlErr || !pdfBlob) return json({ error: `Failed to download contract PDF: ${dlErr?.message ?? 'unknown'}` }, 500)

  const base64 = await blobToBase64(pdfBlob)
  const subject = `Sales Contract — ${trade.trade_reference}`
  const html = buildHtml(
    client?.contact_name ?? client?.company_name ?? 'Customer',
    trade.trade_reference,
    callerProfile.full_name ?? 'Chipa Farm LLC',
  )

  const result = await sendEmail(recipient, subject, html, [
    { filename: doc.file_name, content: base64 },
  ])

  // Stamp the send timestamp ONLY if Resend confirmed the send (or sandbox-skipped).
  // A failure leaves contract_sent_at unchanged so the user can retry.
  if (('ok' in result && result.ok) || ('skipped' in result && result.skipped)) {
    await supabaseAdmin
      .from('trades')
      .update({ contract_sent_at: new Date().toISOString() })
      .eq('id', trade_id)
  }

  await supabaseAdmin.from('audit_logs').insert({
    user_id: caller.id,
    action: 'contract_sent_to_client',
    entity_type: 'trade',
    entity_id: trade_id,
    new_value: { recipient, trade_reference: trade.trade_reference, result },
  })

  return json({ ok: true, recipient, trade_reference: trade.trade_reference, result })
})
