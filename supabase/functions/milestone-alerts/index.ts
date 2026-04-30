// @ts-expect-error — Deno-only import resolved at runtime by the edge runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Response | Promise<Response>): void }

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Resend "from" address.
// - Sandbox (current default): `onboarding@resend.dev` — works without a
//   verified domain, but Resend will ONLY deliver to the email registered
//   on the Resend account. Fine while testing with a single super_admin.
// - Production: once chipafarm.com (or another domain) is verified at
//   https://resend.com/domains, set the RESEND_FROM env var in Supabase
//   Edge Function secrets to e.g. `TradeMirror Alerts <alerts@chipafarm.com>`.
//   No code change required — the env var override is read at runtime.
const FROM_ADDRESS = Deno.env.get('RESEND_FROM') ?? 'TradeMirror Alerts <onboarding@resend.dev>'

async function sendEmail(to: string, subject: string, html: string) {
  // Best-effort: never throw. Status-flip + audit logging must succeed even
  // if Resend is misconfigured or the recipient isn't allow-listed.
  try {
    if (!RESEND_API_KEY) {
      console.warn('[milestone-alerts] RESEND_API_KEY not set — skipping email')
      return
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[milestone-alerts] Resend error:', res.status, err)
    }
  } catch (err) {
    console.error('[milestone-alerts] sendEmail threw:', err)
  }
}

function buildEmailHtml(params: {
  clientName: string
  milestoneType: 'Advance' | 'Balance'
  tradeRef: string
  amountDue: number
  dueDate: string
  daysOverdue: number
  tradeId: string
}) {
  const { clientName, milestoneType, tradeRef, amountDue, dueDate, daysOverdue, tradeId } = params
  const appUrl = Deno.env.get('APP_URL') ?? 'https://trademirror.vercel.app'
  const tradeUrl = `${appUrl}/trades/${tradeId}`

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f8fafc; margin:0; padding:40px 20px; }
  .card { background:#fff; border-radius:12px; max-width:560px; margin:0 auto; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.1); }
  .header { background:#0ea5e9; padding:28px 32px; }
  .header h1 { color:#fff; margin:0; font-size:22px; }
  .header p { color:#bae6fd; margin:4px 0 0; font-size:14px; }
  .body { padding:28px 32px; }
  .alert-box { background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:16px 20px; margin-bottom:24px; }
  .alert-box h2 { color:#dc2626; margin:0 0 4px; font-size:16px; }
  .alert-box p { color:#7f1d1d; margin:0; font-size:14px; }
  .details { border-top:1px solid #e2e8f0; padding-top:20px; }
  .row { display:flex; justify-content:space-between; padding:6px 0; font-size:14px; border-bottom:1px solid #f1f5f9; }
  .row .label { color:#64748b; }
  .row .value { color:#0f172a; font-weight:500; }
  .cta { margin-top:28px; text-align:center; }
  .btn { display:inline-block; background:#0ea5e9; color:#fff; padding:12px 28px; border-radius:8px; text-decoration:none; font-weight:600; font-size:15px; }
  .footer { padding:20px 32px; border-top:1px solid #e2e8f0; font-size:12px; color:#94a3b8; text-align:center; }
</style></head>
<body>
<div class="card">
  <div class="header">
    <h1>TradeMirror OS</h1>
    <p>Milestone Alert — Action Required</p>
  </div>
  <div class="body">
    <div class="alert-box">
      <h2>${clientName} — ${milestoneType} Payment Overdue</h2>
      <p>This milestone has passed its due date and requires immediate attention.</p>
    </div>
    <div class="details">
      <div class="row"><span class="label">Trade Reference</span><span class="value">${tradeRef}</span></div>
      <div class="row"><span class="label">Client</span><span class="value">${clientName}</span></div>
      <div class="row"><span class="label">Milestone</span><span class="value">${milestoneType} Payment</span></div>
      <div class="row"><span class="label">Amount Due</span><span class="value">$${amountDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
      <div class="row"><span class="label">Due Date</span><span class="value">${dueDate}</span></div>
      <div class="row"><span class="label">Days Overdue</span><span class="value" style="color:#dc2626">${daysOverdue} days</span></div>
    </div>
    <div class="cta">
      <a href="${tradeUrl}" class="btn">View Trade Folder</a>
    </div>
  </div>
  <div class="footer">
    Sent automatically by TradeMirror OS &mdash; Chipa Farm LLC internal platform
  </div>
</div>
</body>
</html>`
}

/** True iff the given timestamp is on a different UTC calendar day than
 *  `now`. Used to dedupe alerts to at most one per (trade, milestone, day)
 *  per PRD §11.1 ("repeat DAILY until received"). */
function alreadySentToday(lastSentAt: string | null, now: Date): boolean {
  if (!lastSentAt) return false
  const last = new Date(lastSentAt)
  return (
    last.getUTCFullYear() === now.getUTCFullYear() &&
    last.getUTCMonth() === now.getUTCMonth() &&
    last.getUTCDate() === now.getUTCDate()
  )
}

Deno.serve(async (_req: Request) => {
  try {
    const now = new Date()

    // Get all super_admin emails
    const { data: admins } = await supabase
      .from('users')
      .select('email')
      .eq('role', 'super_admin')
      .eq('is_active', true)

    const adminEmails = (admins ?? []).map((u: { email: string }) => u.email)
    if (adminEmails.length === 0) {
      return new Response(JSON.stringify({ message: 'No admins found' }), { status: 200 })
    }

    let alertsSent = 0
    let alertsSkipped = 0

    // --- Advance overdue: signing_date + 7 days < now AND status not 'received'.
    // Per spec §11.1 alerts repeat daily until the milestone is marked
    // received, so we include both 'pending' and already-flipped 'overdue'.
    const { data: advanceOverdue } = await supabase
      .from('trades')
      .select('id, trade_reference, sale_total, signing_date, advance_status, advance_alert_sent_at, clients(company_name)')
      .in('advance_status', ['pending', 'overdue'])
      .not('signing_date', 'is', null)
      .lt('signing_date', new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0])

    for (const trade of advanceOverdue ?? []) {
      const client = trade.clients as { company_name: string } | null
      const clientName = client?.company_name ?? 'Unknown Client'
      const dueDate = new Date(trade.signing_date)
      dueDate.setDate(dueDate.getDate() + 7)
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / 86400000)
      const amountDue = Number(trade.sale_total) * 0.5

      // Always flip status to overdue (cheap, idempotent) — but only send
      // the email once per UTC day per spec §11.1.
      await supabase
        .from('trades')
        .update({ advance_status: 'overdue', trade_status: 'overdue' })
        .eq('id', trade.id)

      if (alreadySentToday(trade.advance_alert_sent_at, now)) {
        alertsSkipped++
        continue
      }

      const subject = `TradeMirror Alert: ${clientName} — Advance Overdue`
      const html = buildEmailHtml({
        clientName,
        milestoneType: 'Advance',
        tradeRef: trade.trade_reference,
        amountDue,
        dueDate: dueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        daysOverdue,
        tradeId: trade.id,
      })
      for (const email of adminEmails) {
        await sendEmail(email, subject, html)
      }

      // Stamp send time AFTER successful dispatch so a transient cron retry
      // before this update doesn't accidentally suppress a real send.
      await supabase
        .from('trades')
        .update({ advance_alert_sent_at: now.toISOString() })
        .eq('id', trade.id)

      await supabase.from('audit_logs').insert({
        action: 'milestone_overdue',
        entity_type: 'trade',
        entity_id: trade.id,
        new_value: { milestone: 'advance', days_overdue: daysOverdue },
      })

      alertsSent++
    }

    // --- Balance overdue: bol_date + 7 days < now AND status not 'received'.
    // Per spec §11.1, alerts repeat daily until the milestone is received.
    const { data: balanceOverdue } = await supabase
      .from('trades')
      .select('id, trade_reference, sale_total, bol_date, balance_status, balance_alert_sent_at, clients(company_name)')
      .in('balance_status', ['pending', 'overdue'])
      .not('bol_date', 'is', null)
      .lt('bol_date', new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0])

    for (const trade of balanceOverdue ?? []) {
      const client = trade.clients as { company_name: string } | null
      const clientName = client?.company_name ?? 'Unknown Client'
      const dueDate = new Date(trade.bol_date)
      dueDate.setDate(dueDate.getDate() + 7)
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / 86400000)
      const amountDue = Number(trade.sale_total) * 0.5

      await supabase
        .from('trades')
        .update({ balance_status: 'overdue', trade_status: 'overdue' })
        .eq('id', trade.id)

      if (alreadySentToday(trade.balance_alert_sent_at, now)) {
        alertsSkipped++
        continue
      }

      const subject = `TradeMirror Alert: ${clientName} — Balance Overdue`
      const html = buildEmailHtml({
        clientName,
        milestoneType: 'Balance',
        tradeRef: trade.trade_reference,
        amountDue,
        dueDate: dueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        daysOverdue,
        tradeId: trade.id,
      })
      for (const email of adminEmails) {
        await sendEmail(email, subject, html)
      }

      await supabase
        .from('trades')
        .update({ balance_alert_sent_at: now.toISOString() })
        .eq('id', trade.id)

      await supabase.from('audit_logs').insert({
        action: 'milestone_overdue',
        entity_type: 'trade',
        entity_id: trade.id,
        new_value: { milestone: 'balance', days_overdue: daysOverdue },
      })

      alertsSent++
    }

    return new Response(
      JSON.stringify({ success: true, alertsSent, alertsSkipped }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err) {
    console.error('milestone-alerts error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
