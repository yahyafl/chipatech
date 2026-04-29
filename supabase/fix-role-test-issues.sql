-- ============================================================
-- TradeMirror OS — Pre-fixes for predicted Internal/Partner test failures
--
-- Run AFTER: fix-rls-matrix.sql, seed-test-roles.sql
-- Purpose:    Address bugs that the role-specific UI/logic tests would
--             surface, derived from code-path analysis of pages each
--             role will visit.
-- ============================================================

-- ─── Partner needs to read clients (data only) ────────────────────────
-- PartnerDashboard / PartnerTradeDetail render `trade.client.company_name`.
-- Without SELECT on clients the Partner sees '—' for every trade and
-- can't identify their portfolio. Per PRD §2.3 partners can't access the
-- Client CMS page (UI-level — already enforced by /partner layout) but
-- DO need the joined client name on trade views.
DROP POLICY IF EXISTS "clients_select_admin_internal" ON clients;

CREATE POLICY "clients_select_admin_internal_partner" ON clients
  FOR SELECT USING ((SELECT get_user_role()) IN ('super_admin', 'internal', 'partner'));

-- ─── Column-level protection for Internal — trades_basic view ─────────
-- Internal team is allowed to see trade list rows but NOT financial
-- columns (frigo_total, sale_total, net_profit, total_costs, etc.). RLS
-- is row-level, so without a view a malicious Internal user could query
-- `select=frigo_total` directly via API and bypass the frontend hide.
--
-- Approach: a view that excludes financial columns. Frontend can switch
-- to this view based on role — see comment in fix-rls-trade-financials.sql.
CREATE OR REPLACE VIEW public.trades_basic AS
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
  -- Hidden: frigo_unit_price, frigo_total, sale_unit_price, sale_total,
  --         shipping_cost, insurance_cost, bank_fees, total_costs,
  --         net_profit
  advance_status,
  advance_received_at,
  balance_status,
  balance_received_at,
  trade_status,
  created_at,
  updated_at
FROM public.trades;

ALTER VIEW public.trades_basic SET (security_invoker = true);
GRANT SELECT ON public.trades_basic TO authenticated;

-- ─── Verify the matrix is what we expect after these changes ─────────
SELECT 'final_rls_matrix' AS check_name,
       tablename,
       cmd,
       policyname,
       substring(qual FROM 1 FOR 60) AS condition_preview
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('trades', 'clients', 'contacts', 'bank_profiles', 'entities', 'documents', 'users')
ORDER BY tablename, cmd;
