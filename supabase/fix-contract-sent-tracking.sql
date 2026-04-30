-- ============================================================
-- Track when the generated sales contract was emailed to the client.
-- Lets the UI show "Sent at <timestamp>" on the trade detail page and
-- prevents double-sends from accidental button mashing.
--
-- Run once in Supabase → SQL Editor. Idempotent.
-- ============================================================

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS contract_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN trades.contract_sent_at IS
  'Timestamp of the most recent contract email sent to the client via the send-contract-to-client edge function. NULL = never sent.';
