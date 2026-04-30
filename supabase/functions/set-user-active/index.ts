// Edge Function: set-user-active
// Toggles public.users.is_active. On deactivation it ALSO calls
// auth.admin.signOut(user_id) so the target's existing JWT is invalidated
// immediately — without this the deactivated user could keep using the app
// until their token naturally expires (PRD §2.2.4 "immediately locked out").
//
// Only super_admin can call this. A super_admin cannot deactivate themselves.

// @ts-expect-error — Deno-only import resolved at runtime by the edge runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Response | Promise<Response>): void }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => {
  if (status >= 400) console.error(`[set-user-active] ${status}`, body)
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

  const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  const { data: { user: caller }, error: callerErr } = await supabaseAuth.auth.getUser(jwt)
  if (callerErr || !caller) {
    return json({ error: callerErr?.message ?? 'Invalid auth token' }, 401)
  }

  const { data: callerProfile, error: profileErr } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', caller.id)
    .single()

  if (profileErr || !callerProfile) return json({ error: 'Caller profile not found' }, 403)
  if (callerProfile.role !== 'super_admin') return json({ error: 'Only super admins can change user status' }, 403)

  let body: { user_id?: string; is_active?: boolean }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { user_id, is_active } = body
  if (!user_id) return json({ error: 'Missing required field: user_id' }, 400)
  if (typeof is_active !== 'boolean') return json({ error: 'Missing required field: is_active (boolean)' }, 400)
  if (user_id === caller.id && is_active === false) {
    return json({ error: 'You cannot deactivate your own account' }, 400)
  }

  const { error: updateErr } = await supabaseAdmin
    .from('users')
    .update({ is_active })
    .eq('id', user_id)

  if (updateErr) return json({ error: `Status update failed: ${updateErr.message}` }, 500)

  // Invalidate any existing sessions so the user is locked out immediately
  // (the JWT itself stays valid until expiry, but signOut revokes the
  // refresh token, and our get_user_role() helper returns NULL for inactive
  // users so role-gated RLS policies fail on the next request).
  if (is_active === false) {
    const { error: signOutErr } = await supabaseAdmin.auth.admin.signOut(user_id)
    if (signOutErr) {
      console.error('[set-user-active] signOut failed (non-fatal):', signOutErr.message)
    }
  }

  return json({ success: true, user_id, is_active })
})
