-- ============================================================
-- ORIGIN CLINICIAN LINK MIGRATION
--
-- Adds:
--   • Consent toggle (shares_adherence_with_clinician)
--   • Clinician-side archive (archived_by_clinician_at)
--   • Manual approval queue (clinician_status)
--   • Personal clinician code for in-person linking (clinician_code)
--   • clinician_invites table — email-based invite flow with
--     optional attached protocol snapshot
--   • RLS rewrites that split "identity" reads (always visible
--     to linked clinician) from "adherence" reads (gated on the
--     patient's consent toggle)
--
-- Safe to re-run: every statement idempotent.
-- Transactional: BEGIN/COMMIT wraps everything — a failure
-- mid-way rolls back to the prior state.
--
-- Run via:
--   supabase db query --linked -f supabase/clinician-link-migration.sql
-- or paste into Supabase Dashboard SQL Editor.
-- ============================================================

BEGIN;

-- ── 1. New columns on user_profiles ──────────────────────────
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS shares_adherence_with_clinician boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_by_clinician_at timestamptz,
  ADD COLUMN IF NOT EXISTS clinician_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS clinician_code text;

-- Constraint on clinician_status values
DO $$
BEGIN
  ALTER TABLE user_profiles
    ADD CONSTRAINT user_profiles_clinician_status_check
    CHECK (clinician_status IN ('none','pending','approved'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Unique constraint on clinician_code (only enforced when set)
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_clinician_code_unique
  ON user_profiles (clinician_code)
  WHERE clinician_code IS NOT NULL;

-- ── 2. Grandfather existing clinicians ───────────────────────
-- Anyone today with is_clinician = true is auto-approved.
UPDATE user_profiles
SET clinician_status = 'approved'
WHERE is_clinician = true AND clinician_status = 'none';

-- ── 3. clinician_invites table ───────────────────────────────
CREATE TABLE IF NOT EXISTS clinician_invites (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinician_id                    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_email                   text NOT NULL,
  attached_supplements_snapshot   jsonb,
  attached_protocol_name          text,
  attached_protocol_starts_at     date,
  attached_protocol_ends_at       date,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  accepted_at                     timestamptz,
  declined_at                     timestamptz
);

CREATE INDEX IF NOT EXISTS clinician_invites_invitee_email_idx
  ON clinician_invites (lower(invitee_email))
  WHERE accepted_at IS NULL AND declined_at IS NULL;

CREATE INDEX IF NOT EXISTS clinician_invites_clinician_id_idx
  ON clinician_invites (clinician_id);

ALTER TABLE clinician_invites ENABLE ROW LEVEL SECURITY;

-- ── 4. RLS for clinician_invites ─────────────────────────────
DROP POLICY IF EXISTS clinician_manages_own_invites ON clinician_invites;
CREATE POLICY clinician_manages_own_invites
  ON clinician_invites FOR ALL TO authenticated
  USING (clinician_id = auth.uid())
  WITH CHECK (clinician_id = auth.uid());

DROP POLICY IF EXISTS patient_reads_own_invites ON clinician_invites;
CREATE POLICY patient_reads_own_invites
  ON clinician_invites FOR SELECT TO authenticated
  USING (lower(invitee_email) = lower(auth.email()));

DROP POLICY IF EXISTS patient_responds_to_own_invites ON clinician_invites;
CREATE POLICY patient_responds_to_own_invites
  ON clinician_invites FOR UPDATE TO authenticated
  USING (lower(invitee_email) = lower(auth.email()))
  WITH CHECK (lower(invitee_email) = lower(auth.email()));

-- ── 5. Split clinician read access by data type ──────────────
-- Identity (user_profiles) policy stays as-is — clinician
-- always sees linked patient's profile row.
-- Adherence-bearing tables (supplements, protocols, daily_logs,
-- user_schedule) now also require shares_adherence_with_clinician = true.

DROP POLICY IF EXISTS clinician_reads_patient_supplements ON supplements;
CREATE POLICY clinician_reads_patient_supplements
  ON supplements FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = supplements.user_id
        AND up.clinician_user_id = auth.uid()
        AND up.shares_adherence_with_clinician = true
    )
  );

DROP POLICY IF EXISTS clinician_reads_patient_protocols ON protocols;
CREATE POLICY clinician_reads_patient_protocols
  ON protocols FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = protocols.user_id
        AND up.clinician_user_id = auth.uid()
        AND up.shares_adherence_with_clinician = true
    )
  );

DROP POLICY IF EXISTS clinician_reads_patient_logs ON daily_logs;
CREATE POLICY clinician_reads_patient_logs
  ON daily_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = daily_logs.user_id
        AND up.clinician_user_id = auth.uid()
        AND up.shares_adherence_with_clinician = true
    )
  );

DROP POLICY IF EXISTS clinician_reads_patient_schedule ON user_schedule;
CREATE POLICY clinician_reads_patient_schedule
  ON user_schedule FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = user_schedule.user_id
        AND up.clinician_user_id = auth.uid()
        AND up.shares_adherence_with_clinician = true
    )
  );

COMMIT;
