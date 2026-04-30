-- ============================================================
-- TradeMirror OS — Audit log hardening (audit findings H-3, L-3)
--
-- Run once in Supabase → SQL Editor.
-- ============================================================

-- H-3: previous policy let any authenticated user write any audit row.
-- Forge "super_admin deleted user X" was trivial. Replace with a strict
-- policy that pins user_id to the caller and whitelists the action enum.
DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON audit_logs;
DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON audit_logs;

CREATE POLICY "audit_logs_insert_self_whitelisted" ON audit_logs
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND action IN (
      'contract_generated',
      'milestone_overdue',
      'field_unlocked',
      'status_email_sent',
      'document_uploaded',
      'document_deleted',
      'user_invited',
      'user_deleted',
      'user_role_updated'
    )
  );

-- Block UPDATE / DELETE on audit_logs at the RLS layer. Append-only.
DROP POLICY IF EXISTS "audit_logs_no_update" ON audit_logs;
CREATE POLICY "audit_logs_no_update" ON audit_logs
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "audit_logs_no_delete" ON audit_logs;
CREATE POLICY "audit_logs_no_delete" ON audit_logs
  FOR DELETE USING (false);

-- Verify
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'audit_logs'
ORDER BY cmd;
