// Edge Function: delete-user
// Permanently deletes a user from auth.users + public.users.
// Only super_admin can call this. A super_admin cannot delete themselves.

// @ts-expect-error — Deno-only import resolved at runtime by the edge runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Response | Promise<Response>): void }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => {
  if (status >= 400) console.error(`[delete-user] ${status}`, body)
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
  if (callerProfile.role !== 'super_admin') return json({ error: 'Only super admins can delete users' }, 403)

  let body: { user_id?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { user_id } = body
  if (!user_id) return json({ error: 'Missing required field: user_id' }, 400)
  if (user_id === caller.id) return json({ error: 'You cannot delete your own account' }, 400)

  // Delete from auth.users — this also cascades to public.users if FK is set up
  const { error: authDeleteErr } = await supabaseAdmin.auth.admin.deleteUser(user_id)
  if (authDeleteErr) {
    return json({ error: `Auth delete failed: ${authDeleteErr.message}` }, 500)
  }

  // Belt-and-suspenders: also remove the public.users row in case the FK
  // cascade didn't fire (e.g. RESTRICT instead of CASCADE).
  await supabaseAdmin.from('users').delete().eq('id', user_id)

  return json({ success: true, deleted_user_id: user_id })
})
