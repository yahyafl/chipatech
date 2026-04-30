// Edge Function: invite-user
// Called from the browser by a logged-in super_admin.
// Verifies the caller, sends a Supabase invite email, and creates the
// matching row in the public.users table.

// @ts-expect-error — Deno-only import resolved at runtime by the edge runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Response | Promise<Response>): void }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => {
  if (status >= 400) console.error(`[invite-user] ${status}`, body)
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
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

  // Caller-scoped client — confirms who is calling
  const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  // Service-role client — bypasses RLS for admin work
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // In Edge Functions getUser() must be passed the JWT explicitly —
  // it can't pull it from the client's session because there is none.
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  const { data: { user: caller }, error: callerErr } = await supabaseAuth.auth.getUser(jwt)
  if (callerErr || !caller) {
    console.error('[invite-user] getUser failed:', callerErr?.message)
    return json({ error: callerErr?.message ?? 'Invalid auth token' }, 401)
  }

  // Only super_admin can invite
  const { data: callerProfile, error: profileErr } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', caller.id)
    .single()

  if (profileErr || !callerProfile) return json({ error: 'Caller profile not found' }, 403)
  if (callerProfile.role !== 'super_admin') return json({ error: 'Only super admins can invite users' }, 403)

  let body: { email?: string; full_name?: string; role?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { email, full_name, role } = body
  if (!email || !full_name || !role) {
    return json({ error: 'Missing required fields: email, full_name, role' }, 400)
  }
  // Server-side email format check (M-6) — frontend may be bypassed.
  const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!EMAIL_RX.test(email) || email.length > 254) {
    return json({ error: 'Invalid email format' }, 400)
  }
  if (full_name.length < 1 || full_name.length > 120) {
    return json({ error: 'Invalid full_name length (1-120)' }, 400)
  }
  if (!['super_admin', 'internal', 'partner'].includes(role)) {
    return json({ error: 'Invalid role' }, 400)
  }

  // Block duplicate invites at BOTH the public.users layer AND the
  // auth.users layer (H-5) — previously we only checked one, so an
  // orphaned auth row from an abandoned invite would cause a confusing
  // failure mid-flow.
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (existing) return json({ error: 'A user with that email already exists' }, 409)

  const { data: authList, error: listErr } = await supabaseAdmin.auth.admin.listUsers()
  if (listErr) return json({ error: `auth.users lookup failed: ${listErr.message}` }, 500)
  if (authList?.users.some(u => u.email?.toLowerCase() === email.toLowerCase())) {
    return json({ error: 'An auth account with that email already exists' }, 409)
  }

  // Origin used in the invite email's "Set password" link
  const origin = req.headers.get('origin') ?? Deno.env.get('APP_URL') ?? ''
  const redirectTo = origin ? `${origin}/accept-invite` : undefined

  const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { full_name, role },
    redirectTo,
  })

  if (inviteErr || !invited.user) {
    return json({ error: inviteErr?.message ?? 'Invite failed' }, 400)
  }

  // Create the public.users row that drives RLS / role-based UI
  const { error: insertErr } = await supabaseAdmin.from('users').upsert({
    id: invited.user.id,
    email,
    full_name,
    role,
    is_active: true,
    invited_at: new Date().toISOString(),
  })

  if (insertErr) {
    // Roll back the auth user so the next invite attempt isn't blocked
    await supabaseAdmin.auth.admin.deleteUser(invited.user.id)
    return json({ error: `Profile insert failed: ${insertErr.message}` }, 500)
  }

  return json({ success: true, user_id: invited.user.id, email })
})
