-- ============================================================
-- TradeMirror OS — RLS Performance Fix
--
-- Problem: get_user_role() is called once per ROW because RLS
-- functions are inlined. Wrapping in (SELECT ...) tells Postgres
-- to evaluate it ONCE per query and cache the result — a massive
-- win when the table has many rows.
--
-- Run in Supabase → SQL Editor. Safe to run multiple times.
-- ============================================================

-- Users
DROP POLICY IF EXISTS "SuperAdmin can manage all users" ON users;
CREATE POLICY "SuperAdmin can manage all users" ON users
  FOR ALL USING ((SELECT get_user_role()) = 'super_admin');

-- Also add the missing INSERT policy (needed for first login)
DROP POLICY IF EXISTS "Users can insert their own record" ON users;
CREATE POLICY "Users can insert their own record" ON users
  FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own record" ON users;
CREATE POLICY "Users can update their own record" ON users
  FOR UPDATE USING (id = auth.uid());

-- Entities
DROP POLICY IF EXISTS "SuperAdmin can manage entities" ON entities;
CREATE POLICY "SuperAdmin can manage entities" ON entities
  FOR ALL USING ((SELECT get_user_role()) = 'super_admin');

-- Bank profiles
DROP POLICY IF EXISTS "SuperAdmin can manage bank_profiles" ON bank_profiles;
CREATE POLICY "SuperAdmin can manage bank_profiles" ON bank_profiles
  FOR ALL USING ((SELECT get_user_role()) = 'super_admin');

-- Clients
DROP POLICY IF EXISTS "SuperAdmin can manage clients" ON clients;
CREATE POLICY "SuperAdmin can manage clients" ON clients
  FOR ALL USING ((SELECT get_user_role()) = 'super_admin');

-- Contacts
DROP POLICY IF EXISTS "SuperAdmin can manage contacts" ON contacts;
CREATE POLICY "SuperAdmin can manage contacts" ON contacts
  FOR ALL USING ((SELECT get_user_role()) = 'super_admin');

-- Trades
DROP POLICY IF EXISTS "SuperAdmin can manage trades" ON trades;
CREATE POLICY "SuperAdmin can manage trades" ON trades
  FOR ALL USING ((SELECT get_user_role()) = 'super_admin');

DROP POLICY IF EXISTS "Internal can update trade status" ON trades;
CREATE POLICY "Internal can update trade status" ON trades
  FOR UPDATE USING ((SELECT get_user_role()) IN ('super_admin', 'internal'));

-- Documents
DROP POLICY IF EXISTS "SuperAdmin and Internal can upload documents" ON documents;
CREATE POLICY "SuperAdmin and Internal can upload documents" ON documents
  FOR INSERT WITH CHECK ((SELECT get_user_role()) IN ('super_admin', 'internal'));

DROP POLICY IF EXISTS "SuperAdmin can delete documents" ON documents;
CREATE POLICY "SuperAdmin can delete documents" ON documents
  FOR DELETE USING ((SELECT get_user_role()) = 'super_admin');

-- Audit logs
DROP POLICY IF EXISTS "SuperAdmin can read audit logs" ON audit_logs;
CREATE POLICY "SuperAdmin can read audit logs" ON audit_logs
  FOR SELECT USING ((SELECT get_user_role()) = 'super_admin');

-- App settings
DROP POLICY IF EXISTS "SuperAdmin can manage settings" ON app_settings;
CREATE POLICY "SuperAdmin can manage settings" ON app_settings
  FOR ALL USING ((SELECT get_user_role()) = 'super_admin');

-- Verify policies were created
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
