-- ============================================================
-- Block Internal users from reading the raw `trades` table at the DB
-- level (per PRD §3.2 / §3.4: Internal "Cannot access financial ledger
-- details"). Internal users may only read via the trades_basic VIEW,
-- which omits frigo_total / sale_total / net_profit / total_costs /
-- shipping_cost / insurance_cost / bank_fees / unit prices.
--
-- Run this once in Supabase → SQL Editor. Idempotent.
--
-- Pre-fix
-- -------
-- Policy `trades_select_authenticated` allowed any authenticated user
-- (including internal) to `select * from trades`. The frontend correctly
-- routed internal users to trades_basic, but a determined user with
-- their JWT and the supabase JS client could bypass that and pull every
-- financial column.
--
-- Fix
-- ---
-- Tighten the SELECT policy on `trades` to (super_admin OR partner)
-- AND is_user_active(). Internal users querying `trades` directly now
-- get an empty result set; they must query `trades_basic` (which still
-- works because the view inherits the underlying table's RLS via
-- security_invoker — but with a separate, looser policy below that
-- the view will pass through).
--
-- The trades_basic VIEW itself is created in fix-rls-trade-financials.sql.
-- That file should be run BEFORE this one. After both run, internal
-- users have read access only to non-financial columns, full stop.
-- ============================================================

-- 1. Tighten the trades SELECT policy. Replaces the prior
--    "trades_select_authenticated" / is_user_active variant.
DROP POLICY IF EXISTS "trades_select_authenticated" ON trades;
DROP POLICY IF EXISTS "trades_select_admin_partner" ON trades;
CREATE POLICY "trades_select_admin_partner" ON trades
  FOR SELECT USING (
    is_user_active()
    AND (SELECT get_user_role()) IN ('super_admin', 'partner')
  );

-- 2. trades_basic VIEW: keep `security_invoker = true` so RLS still
--    applies — but we need a SEPARATE policy that lets internal in.
--    Approach: when a user reads via trades_basic, the view re-runs the
--    underlying SELECT against `trades`. With security_invoker, that
--    SELECT runs as the calling user and hits the policy above, which
--    excludes internal. So we need to either:
--      (a) drop security_invoker so the view runs with definer rights, OR
--      (b) add an explicit policy that allows internal SELECT on trades
--          but only when accessed via trades_basic (impossible to detect
--          inside a USING clause).
--    Pragmatic choice: switch trades_basic to security_definer so the
--    view's owner (postgres) does the SELECT, bypassing trades' RLS.
--    Internal still can't read `trades` directly — only the limited view.

ALTER VIEW trades_basic SET (security_invoker = false);

-- 3. Make sure the view exposes ONLY the safe columns. (Recreate
--    idempotently — matches the column set in fix-rls-trade-financials.sql.)
CREATE OR REPLACE VIEW trades_basic AS
SELECT
  id,
  trade_reference,
  entity_id,
  client_id,
  contact_id,
  contract_date,
  signing_date,
  bol_date,
  frigo_contract_ref,
  quantity_tons,
  product_description,
  -- frigo_unit_price / frigo_total / sale_unit_price / sale_total /
  -- shipping_cost / insurance_cost / bank_fees / total_costs /
  -- net_profit are deliberately omitted.
  advance_status,
  advance_received_at,
  balance_status,
  balance_received_at,
  trade_status,
  created_at,
  updated_at
FROM trades;

-- security_definer view: re-apply the setting after CREATE OR REPLACE.
ALTER VIEW trades_basic SET (security_invoker = false);

-- Grant SELECT on the view to authenticated. RLS no longer applies to
-- the underlying table when this view is queried (because we just
-- switched it to security_definer), so internal users can read the
-- non-financial columns through the view but cannot read `trades`.
GRANT SELECT ON trades_basic TO authenticated;

-- ============================================================
-- Verification — try this as an internal user via SQL Editor
-- (impersonate a session by setting auth.uid() if you can):
--
--   SELECT * FROM trades        LIMIT 1;        -- expect 0 rows
--   SELECT * FROM trades_basic  LIMIT 1;        -- expect rows w/o financials
--
-- And inspect the policy + view definitions:
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'trades' AND cmd = 'SELECT';

SELECT relname, reloptions
FROM pg_class
WHERE relname = 'trades_basic';
-- ============================================================
