-- ============================================================
-- Per-trade, per-milestone tracker for the last alert email send time.
-- Lets the milestone-alerts cron de-duplicate to at most one email per
-- (trade, milestone, calendar day). Without this, every cron tick (or
-- manual invocation) re-emails every overdue milestone and floods admins.
--
-- Run once in Supabase → SQL Editor. Idempotent.
-- ============================================================

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS advance_alert_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS balance_alert_sent_at TIMESTAMPTZ;

-- Existing overdue trades will look like "never alerted" so the next cron
-- run resends each one — that's the spec-correct behaviour ("repeat daily
-- until received"), just at the cost of one extra email each on the day
-- this column is added. Acceptable.

COMMENT ON COLUMN trades.advance_alert_sent_at IS
  'Timestamp of the most recent advance overdue email. Used by milestone-alerts to skip if already sent today.';
COMMENT ON COLUMN trades.balance_alert_sent_at IS
  'Timestamp of the most recent balance overdue email. Used by milestone-alerts to skip if already sent today.';
