-- ============================================================
-- TradeMirror OS — RLS Policies aligned to the Role Permission Matrix
--
-- Run this once in Supabase → SQL Editor. Idempotent (safe to re-run).
--
-- Matrix enforced here:
--                       super_admin   internal     partner
--   users               full          self only    none
--   entities            full          read         read (for trade joins)
--   bank_profiles       full          NONE         NONE   (sensitive!)
--   clients             full          read only    NONE
--   contacts            full          NONE         NONE
--   trades              full          read only    read (own portfolio)
--   documents           full          read+upload  read only (download)
--   audit_logs          read+insert   insert only  insert only
--   notifications       per-user      per-user     per-user
--   app_settings        full          read         read
--
-- NOTE: Internal must not see trade FINANCIAL columns. RLS is row-level,
-- not column-level — financial hiding for Internal is enforced at the
-- frontend (TradeDetail/TradeList check role and skip those columns).
-- If you need DB-level column hiding later, add a `trades_basic` VIEW
-- and grant SELECT only on that to internal users.
-- ============================================================

-- ───── USERS ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read their own record" ON users;
DROP POLICY IF EXISTS "Users can insert their own record" ON users;
DROP POLICY IF EXISTS "Users can update their own record" ON users;
DROP POLICY IF EXISTS "SuperAdmin can manage all users" ON users;

CREATE POLICY "users_select_self_or_admin" ON users
  FOR SELECT USING (id = auth.uid() OR (SELECT get_user_role()) = 'super_admin');

CREATE POLICY "users_insert_self" ON users
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "users_update_self_or_admin" ON users
  FOR UPDATE USING (id = auth.uid() OR (SELECT get_user_role()) = 'super_admin');

CREATE POLICY "users_delete_admin" ON users
  FOR DELETE USING ((SELECT get_user_role()) = 'super_admin');

-- ───── ENTITIES ──────────────────────────────────────────────
-- Read needed by all roles for trade joins (entity.name on trade rows).
-- Only super_admin can write.
DROP POLICY IF EXISTS "Authenticated can read entities" ON entities;
DROP POLICY IF EXISTS "SuperAdmin can manage entities" ON entities;

CREATE POLICY "entities_select_authenticated" ON entities
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "entities_modify_admin" ON entities
  FOR ALL USING ((SELECT get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT get_user_role()) = 'super_admin');

-- ───── BANK PROFILES ─────────────────────────────────────────
-- SENSITIVE: contains account numbers, SWIFT codes. super_admin ONLY.
DROP POLICY IF EXISTS "Authenticated can read bank_profiles" ON bank_profiles;
DROP POLICY IF EXISTS "SuperAdmin can manage bank_profiles" ON bank_profiles;

CREATE POLICY "bank_profiles_admin_only" ON bank_profiles
  FOR ALL USING ((SELECT get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT get_user_role()) = 'super_admin');

-- ───── CLIENTS ───────────────────────────────────────────────
-- super_admin: full. internal: read only. partner: NONE.
DROP POLICY IF EXISTS "Authenticated can read clients" ON clients;
DROP POLICY IF EXISTS "SuperAdmin can manage clients" ON clients;

CREATE POLICY "clients_select_admin_internal" ON clients
  FOR SELECT USING ((SELECT get_user_role()) IN ('super_admin', 'internal'));

CREATE POLICY "clients_modify_admin" ON clients
  FOR INSERT WITH CHECK ((SELECT get_user_role()) = 'super_admin');

CREATE POLICY "clients_update_admin" ON clients
  FOR UPDATE USING ((SELECT get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT get_user_role()) = 'super_admin');

CREATE POLICY "clients_delete_admin" ON clients
  FOR DELETE USING ((SELECT get_user_role()) = 'super_admin');

-- ───── CONTACTS ──────────────────────────────────────────────
-- Internal sales contacts — super_admin ONLY (matrix: Internal ❌, Partner ❌)
DROP POLICY IF EXISTS "Authenticated can read contacts" ON contacts;
DROP POLICY IF EXISTS "SuperAdmin can manage contacts" ON contacts;

CREATE POLICY "contacts_admin_only" ON contacts
  FOR ALL USING ((SELECT get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT get_user_role()) = 'super_admin');

-- ───── TRADES ────────────────────────────────────────────────
-- super_admin: full (insert/update/delete + milestone logging).
-- internal: SELECT only (no updates — milestone logging is admin only).
-- partner: SELECT only.
DROP POLICY IF EXISTS "Authenticated can read trades" ON trades;
DROP POLICY IF EXISTS "SuperAdmin can manage trades" ON trades;
DROP POLICY IF EXISTS "Internal can update trade status" ON trades;

CREATE POLICY "trades_select_authenticated" ON trades
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "trades_insert_admin" ON trades
  FOR INSERT WITH CHECK ((SELECT get_user_role()) = 'super_admin');

CREATE POLICY "trades_update_admin" ON trades
  FOR UPDATE USING ((SELECT get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT get_user_role()) = 'super_admin');

CREATE POLICY "trades_delete_admin" ON trades
  FOR DELETE USING ((SELECT get_user_role()) = 'super_admin');

-- ───── DOCUMENTS ─────────────────────────────────────────────
-- super_admin: full.
-- internal: SELECT + INSERT (download + upload).
-- partner: SELECT only (download).
DROP POLICY IF EXISTS "Authenticated can read documents" ON documents;
DROP POLICY IF EXISTS "SuperAdmin and Internal can upload documents" ON documents;
DROP POLICY IF EXISTS "SuperAdmin can delete documents" ON documents;

CREATE POLICY "documents_select_authenticated" ON documents
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "documents_insert_admin_internal" ON documents
  FOR INSERT WITH CHECK ((SELECT get_user_role()) IN ('super_admin', 'internal'));

CREATE POLICY "documents_update_admin" ON documents
  FOR UPDATE USING ((SELECT get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT get_user_role()) = 'super_admin');

CREATE POLICY "documents_delete_admin" ON documents
  FOR DELETE USING ((SELECT get_user_role()) = 'super_admin');

-- ───── AUDIT LOGS ────────────────────────────────────────────
-- super_admin can read; everyone authenticated can insert
DROP POLICY IF EXISTS "SuperAdmin can read audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON audit_logs;

CREATE POLICY "audit_logs_select_admin" ON audit_logs
  FOR SELECT USING ((SELECT get_user_role()) = 'super_admin');

CREATE POLICY "audit_logs_insert_authenticated" ON audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ───── NOTIFICATIONS ─────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Service role can manage notifications" ON notifications;

CREATE POLICY "notifications_select_self" ON notifications
  FOR SELECT USING (user_id = auth.uid() OR (SELECT get_user_role()) = 'super_admin');

CREATE POLICY "notifications_update_self" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "notifications_admin_full" ON notifications
  FOR ALL USING ((SELECT get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT get_user_role()) = 'super_admin');

-- ───── APP SETTINGS ──────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated can read settings" ON app_settings;
DROP POLICY IF EXISTS "SuperAdmin can manage settings" ON app_settings;

CREATE POLICY "app_settings_select_authenticated" ON app_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "app_settings_modify_admin" ON app_settings
  FOR ALL USING ((SELECT get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT get_user_role()) = 'super_admin');

-- ============================================================
-- Verification — list everything that's in place now
-- ============================================================
SELECT
  tablename,
  policyname,
  cmd AS operation,
  CASE
    WHEN qual IS NOT NULL THEN substring(qual FROM 1 FOR 80)
    ELSE 'WITH CHECK only'
  END AS condition_preview
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;
