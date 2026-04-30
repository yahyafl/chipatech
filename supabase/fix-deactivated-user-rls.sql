-- ============================================================
-- Defense-in-depth: gate every role-based RLS check on is_active.
--
-- Run this once in Supabase → SQL Editor. Idempotent (CREATE OR REPLACE).
--
-- Problem this solves
-- -------------------
-- Pre-fix, a deactivated user (is_active=false) could still pass any RLS
-- policy gated only by `auth.uid() IS NOT NULL` because their JWT was
-- still valid. The set-user-active edge function now revokes the session,
-- but if a request slips in before the revoke completes — or if the
-- token is cached client-side — RLS must still deny it.
--
-- Fix
-- ---
-- Modify get_user_role() (used by every existing policy) to return NULL
-- for inactive users. Every `get_user_role() = 'super_admin'`, `IN (..)`,
-- etc. comparison then evaluates to NULL → policy denies.
--
-- For policies that don't go through get_user_role() (ones using only
-- `auth.uid() IS NOT NULL`), we add an `is_user_active()` helper and the
-- caller must update those policies to use it. The current policies in
-- fix-rls-matrix.sql all funnel through get_user_role() so this single
-- function change blocks all role-based ops; pure auth.uid() reads (e.g.,
-- trades_select_authenticated) need the additional `is_user_active()` AND.
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM users WHERE id = auth.uid() AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION is_user_active()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE((SELECT is_active FROM users WHERE id = auth.uid()), false);
$$;

-- Tighten the SELECT-only policies (which previously only checked
-- auth.uid() IS NOT NULL) so a deactivated user can't read either.

-- Trades (everyone authenticated reads → now must also be active)
DROP POLICY IF EXISTS "trades_select_authenticated" ON trades;
CREATE POLICY "trades_select_authenticated" ON trades
  FOR SELECT USING (is_user_active());

-- Documents
DROP POLICY IF EXISTS "documents_select_authenticated" ON documents;
CREATE POLICY "documents_select_authenticated" ON documents
  FOR SELECT USING (is_user_active());

-- Entities
DROP POLICY IF EXISTS "entities_select_authenticated" ON entities;
CREATE POLICY "entities_select_authenticated" ON entities
  FOR SELECT USING (is_user_active());

-- App settings
DROP POLICY IF EXISTS "app_settings_select_authenticated" ON app_settings;
CREATE POLICY "app_settings_select_authenticated" ON app_settings
  FOR SELECT USING (is_user_active());

-- Audit log inserts — keep is_active gate so deactivated users can't
-- silently log audit events from a stale tab.
DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON audit_logs;
CREATE POLICY "audit_logs_insert_authenticated" ON audit_logs
  FOR INSERT WITH CHECK (is_user_active());

-- ============================================================
-- Verification
-- ============================================================
SELECT
  proname AS function_name,
  pg_get_function_result(oid) AS return_type
FROM pg_proc
WHERE proname IN ('get_user_role', 'is_user_active')
  AND pronamespace = 'public'::regnamespace;
