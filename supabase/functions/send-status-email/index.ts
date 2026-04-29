// Edge Function: send-status-email
// Sends a milestone notification to the client's contact email when a trade
// status advances to active/shipped/advance_received/balance_received.

// @ts-expect-error — Deno-only import resolved at runtime by the edge runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Response | Promise<Response>): void }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => {
  if (status >= 400) console.error(`[send-status-email] ${status}`, body)
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const FROM_ADDRESS = Deno.env.get('RESEND_FROM') ?? 'TradeMirror <onboarding@resend.dev>'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

type TradeStatus = 'draft' | 'active' | 'advance_received' | 'shipped' | 'balance_received' | 'overdue'

const COPY: Record<string, { subject: (ref: string) => string; heading: string; body: (clientName: string, ref: string) => string } | undefined> = {
  active: {
    subject: (ref) => `Sales contract issued — ${ref}`,
    heading: 'Contract issued',
    body: (clientName, ref) =>
      `Dear ${clientName},<br><br>Your sales contract <strong>${ref}</strong> has been issued and is awaiting your 50% advance payment. Please find the contract attached to your previous correspondence and proceed with the wire transfer.`,
  },
  advance_received: {
    subject: (ref) => `Advance payment confirmed — ${ref}`,
    heading: 'Advance payment received',
    body: (clientName, ref) =>
      `Dear ${clientName},<br><br>We confirm receipt of your <strong>50% advance payment</strong> for trade <strong>${ref}</strong>. We will proceed with shipment preparation and notify you when the BOL is issued.`,
  },
  shipped: {
    subject: (ref) => `Shipment dispatched — ${ref}`,
    heading: 'Your shipment is on the way',
    body: (clientName, ref) =>
      `Dear ${clientName},<br><br>Your shipment under trade <strong>${ref}</strong> has been dispatched. The Bill of Lading is now available — your <strong>50% balance payment</strong> is due within 7 days of the BOL date.`,
  },
  balance_received: {
    subject: (ref) => `Balance payment confirmed — Trade complete — ${ref}`,
    heading: 'Balance payment received — trade complete',
    body: (clientName, ref) =>
      `Dear ${clientName},<br><br>We confirm receipt of your <strong>50% balance payment</strong> for trade <strong>${ref}</strong>. The trade is now complete. Thank you for your business.`,
  },
}

function buildHtml(heading: string, bodyHtml: string) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f8fafc; margin:0; padding:40px 20px; }
    .card { background:#fff; border-radius:12px; max-width:560px; margin:0 auto; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.1); }
    .header { background:#0ea5e9; padding:28px 32px; }
    .header h1 { color:#fff; margin:0; font-size:22px; }
    .body { padding:28px 32px; color:#0f172a; font-size:15px; line-height:1.55; }
    .footer { padding:20px 32px; border-top:1px solid #e2e8f0; font-size:12px; color:#94a3b8; text-align:center; }
  </style></head><body>
    <div class="card">
      <div class="header"><h1>${heading}</h1></div>
      <div class="body">${bodyHtml}</div>
      <div class="footer">Chipa Farm LLC &mdash; this is an automated notification</div>
    </div>
  </body></html>`
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.warn('[send-status-email] RESEND_API_KEY not set — skipping')
    return { skipped: true }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[send-status-email] Resend error:', res.status, err)
      return { ok: false, error: err }
    }
    return { ok: true }
  } catch (err) {
    console.error('[send-status-email] threw:', err)
    return { ok: false, error: String(err) }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: 'Missing Supabase env vars' }, 500)

  let body: { trade_id?: string; status?: TradeStatus }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { trade_id, status } = body
  if (!trade_id || !status) return json({ error: 'Missing trade_id or status' }, 400)

  const copy = COPY[status]
  if (!copy) return json({ ok: true, skipped: 'no copy for this status' })

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: trade, error } = await supabase
    .from('trades')
    .select('trade_reference, client:clients(company_name, contact_name, contact_email)')
    .eq('id', trade_id)
    .single()

  if (error || !trade) return json({ error: error?.message ?? 'Trade not found' }, 404)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = trade.client as any
  const recipient: string | undefined = client?.contact_email
  if (!recipient) return json({ ok: true, skipped: 'no client contact email' })

  const html = buildHtml(copy.heading, copy.body(client?.contact_name ?? client?.company_name ?? 'Customer', trade.trade_reference))
  const result = await sendEmail(recipient, copy.subject(trade.trade_reference), html)

  // Audit regardless of email outcome
  await supabase.from('audit_logs').insert({
    action: 'status_email_sent',
    entity_type: 'trade',
    entity_id: trade_id,
    new_value: { status, recipient, result },
  })

  return json({ ok: true, recipient, result })
})
