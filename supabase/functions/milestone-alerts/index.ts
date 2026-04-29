import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'TradeMirror Alerts <alerts@chipafarm.com>',
      to,
      subject,
      html,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('Resend error:', err)
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

Deno.serve(async (_req) => {
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

    // --- Advance overdue: signing_date + 7 days < now AND advance_status = 'pending'
    const { data: advanceOverdue } = await supabase
      .from('trades')
      .select('id, trade_reference, sale_total, signing_date, clients(company_name)')
      .eq('advance_status', 'pending')
      .not('signing_date', 'is', null)
      .lt('signing_date', new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0])

    for (const trade of advanceOverdue ?? []) {
      const client = trade.clients as { company_name: string } | null
      const clientName = client?.company_name ?? 'Unknown Client'
      const dueDate = new Date(trade.signing_date)
      dueDate.setDate(dueDate.getDate() + 7)
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / 86400000)
      const amountDue = Number(trade.sale_total) * 0.5

      // Mark overdue
      await supabase
        .from('trades')
        .update({ advance_status: 'overdue', trade_status: 'overdue' })
        .eq('id', trade.id)

      // Send email
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

      // Log audit
      await supabase.from('audit_logs').insert({
        action: 'milestone_overdue',
        entity_type: 'trade',
        entity_id: trade.id,
        new_value: { milestone: 'advance', days_overdue: daysOverdue },
      })

      alertsSent++
    }

    // --- Balance overdue: bol_date + 7 days < now AND balance_status = 'pending'
    const { data: balanceOverdue } = await supabase
      .from('trades')
      .select('id, trade_reference, sale_total, bol_date, clients(company_name)')
      .eq('balance_status', 'pending')
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

      await supabase.from('audit_logs').insert({
        action: 'milestone_overdue',
        entity_type: 'trade',
        entity_id: trade.id,
        new_value: { milestone: 'balance', days_overdue: daysOverdue },
      })

      alertsSent++
    }

    return new Response(
      JSON.stringify({ success: true, alertsSent }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err) {
    console.error('milestone-alerts error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
