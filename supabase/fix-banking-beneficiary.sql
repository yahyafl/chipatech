-- ============================================================
-- TradeMirror OS — UI test report fixes (run once in SQL Editor)
-- ============================================================

-- F-P0-2: Chipa Tech's banking profile had FRIGORIFICO CONCEPCION S.A as
-- the beneficiary, which would route payments to the supplier's account.
-- Beneficiary should be the active entity itself.
UPDATE public.bank_profiles
SET beneficiary_name    = 'CHIPA TECH E.A.S.',
    beneficiary_address = 'CALLE DR. EUSEBIO LILIO Y BERNARDINO CABALLERO #2880, ASUNCION, PARAGUAY'
WHERE entity_id = '11111111-1111-1111-1111-111111111111'
  AND beneficiary_name = 'FRIGORIFICO CONCEPCION S.A';

-- F-P1-2: Recompute trade_status for trades where both milestones are
-- received but the trade still shows 'overdue' (legacy state from before
-- the useMarkMilestoneReceived fix).
UPDATE public.trades
SET trade_status = 'balance_received'
WHERE trade_status = 'overdue'
  AND advance_status = 'received'
  AND balance_status = 'received';

-- Also fix trades that have advance received + balance pending but are
-- stuck on 'overdue' — should be 'advance_received' if no overdue alert
-- on the balance side.
UPDATE public.trades
SET trade_status = 'advance_received'
WHERE trade_status = 'overdue'
  AND advance_status = 'received'
  AND balance_status = 'pending'
  AND (bol_date IS NULL OR bol_date > CURRENT_DATE - INTERVAL '7 days');

-- F-P1-4: Demote duplicate default contacts — keep only the
-- most-recently-created one as default.
WITH latest_default AS (
  SELECT id
  FROM public.contacts
  WHERE is_default = true
  ORDER BY created_at DESC
  LIMIT 1
)
UPDATE public.contacts
SET is_default = false
WHERE is_default = true
  AND id NOT IN (SELECT id FROM latest_default);

-- Verification
SELECT 'bank_profiles' AS table_name, profile_name, beneficiary_name FROM public.bank_profiles ORDER BY profile_name;
SELECT 'overdue_trades_remaining' AS check_name, count(*) AS count FROM public.trades WHERE trade_status = 'overdue';
SELECT 'default_contacts_count' AS check_name, count(*) AS count FROM public.contacts WHERE is_default = true;
