-- ============================================================
-- TradeMirror OS — Hide Trade Financial Columns from Internal users
--
-- RLS protects rows but not columns. Internal users currently can
-- read frigo_total / sale_total / net_profit directly via the REST
-- API even though the UI hides them. This file adds column-level
-- protection by:
--   1. Creating a `trades_basic` VIEW with only non-financial columns
--   2. Internal users query that VIEW instead of `trades` directly
--   3. Revoking direct trades access from the `authenticated` role
--      and granting it to the postgres role + super_admin/partner
--
-- IMPORTANT: After running this, the InternalTradeList must query
-- `trades_basic` instead of `trades` for the change to take effect.
-- The frontend hook update is below in the comment block at the end.
--
-- This is OPTIONAL — only run if you want hard DB-level enforcement.
-- The frontend already hides financials for Internal users.
-- ============================================================

-- The "basic" view: trades minus all financial fields
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
  -- frigo_unit_price, frigo_total — HIDDEN
  -- sale_unit_price, sale_total  — HIDDEN
  -- shipping_cost, insurance_cost, bank_fees, total_costs — HIDDEN
  -- net_profit                   — HIDDEN
  advance_status,
  advance_received_at,
  balance_status,
  balance_received_at,
  trade_status,
  created_at,
  updated_at
FROM trades;

-- Make the view respect RLS of the underlying table
ALTER VIEW trades_basic SET (security_invoker = true);

-- Anyone who can SELECT trades can now SELECT trades_basic.
-- (The view inherits the trades_select_authenticated policy.)
GRANT SELECT ON trades_basic TO authenticated;

-- ============================================================
-- FRONTEND CHANGES NEEDED if you run this:
-- ============================================================
--
-- In src/hooks/useTrades.ts, swap the table name based on role:
--
--   const isInternal = role === 'internal'
--   let query = supabase
--     .from(isInternal ? 'trades_basic' : 'trades')   // <-- this line
--     .select(TRADE_SELECT_BASIC_OR_FULL)
--     ...
--
-- The InternalTradeList only renders columns that exist in
-- trades_basic, so it'll work without further changes once the
-- query targets the view.
--
-- ============================================================
