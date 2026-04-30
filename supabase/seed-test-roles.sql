-- ============================================================
-- TradeMirror OS — Internal Team + Partner test accounts
--
-- Run AFTER: fix-banking-beneficiary.sql, fix-rls-matrix.sql
-- Purpose:    Create accounts for the two non-super_admin roles so the
--             UI/logic tests blocked on §2.2, §2.3, §12, LG-RLS-2..15
--             can actually run.
--
-- IMPORTANT: this script uses Supabase Auth's admin invite endpoint
-- through the dashboard, not raw SQL. The two paths are:
--
--   A) Recommended — invite via the Supabase dashboard then run the
--      role-promotion query at the bottom. Cleanest, gives the user a
--      real password-set email flow.
--
--   B) Direct SQL — only if you need to skip the email step. The bottom
--      block creates rows directly in public.users, but those accounts
--      will NOT be able to log in until matching auth.users rows exist.
--      Use the dashboard for that.
-- ============================================================

-- PATH A — after inviting via dashboard, run THIS to set role.
--
-- TIP: Supabase rejects fake-domain emails (DNS validates MX records).
-- Use Gmail "+" aliases — every variant routes to your main inbox but
-- Supabase treats each as a separate account:
--   yahyamano48+internal@gmail.com   → Internal Team test account
--   yahyamano48+partner@gmail.com    → Partner test account
-- (Both invite emails land in yahyamano48@gmail.com.)

-- For the Internal Team account:
UPDATE public.users
SET role        = 'internal',
    full_name   = 'Internal Test',
    is_active   = true
WHERE email = 'yahyamano48+internal@gmail.com';

-- For the Partner account:
UPDATE public.users
SET role        = 'partner',
    full_name   = 'Partner Test',
    is_active   = true
WHERE email = 'yahyamano48+partner@gmail.com';

-- Verify
SELECT email, full_name, role, is_active, created_at
FROM public.users
WHERE role IN ('internal', 'partner')
ORDER BY role;
