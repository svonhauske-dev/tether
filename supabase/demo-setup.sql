-- ============================================================
-- ORIGIN DEMO SETUP — Phase 0: Schema + RLS
-- Run in Supabase SQL Editor
-- Project: yahimlivfieuknagusxp
-- https://app.supabase.com/project/yahimlivfieuknagusxp/sql/new
--
-- Run all sections in order. If a policy already exists,
-- Supabase will error — safe to ignore and continue.
-- ============================================================

-- ── 1. Add clinician columns to user_profiles ─────────────────
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_clinician boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS clinician_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 2. Create protocol_sends table ────────────────────────────
CREATE TABLE IF NOT EXISTS protocol_sends (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinician_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_protocol_id uuid REFERENCES protocols(id) ON DELETE SET NULL,
  name               text NOT NULL,
  supplements_snapshot jsonb NOT NULL DEFAULT '[]',
  attribution        text,
  sent_at            timestamptz NOT NULL DEFAULT now(),
  status             text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'activated', 'declined')),
  starts_at          date,
  ends_at            date
);

ALTER TABLE protocol_sends ENABLE ROW LEVEL SECURITY;

-- ── 3. RLS: protocol_sends ────────────────────────────────────
-- Clinician manages their own sends
CREATE POLICY "clinician_manages_sends"
  ON protocol_sends FOR ALL TO authenticated
  USING  (clinician_id = auth.uid())
  WITH CHECK (clinician_id = auth.uid());

-- Patient can read their received protocols
CREATE POLICY "patient_reads_received"
  ON protocol_sends FOR SELECT TO authenticated
  USING (patient_id = auth.uid());

-- Patient can update (activate/decline) their received protocols
CREATE POLICY "patient_updates_received"
  ON protocol_sends FOR UPDATE TO authenticated
  USING  (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid());

-- ── 4. RLS: clinician reads patient user_profiles ─────────────
-- (clinician can read profiles of patients assigned to them)
CREATE POLICY "clinician_reads_patient_profiles"
  ON user_profiles FOR SELECT TO authenticated
  USING (clinician_user_id = auth.uid());

-- ── 5. RLS: clinician reads patient supplements ───────────────
CREATE POLICY "clinician_reads_patient_supplements"
  ON supplements FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = supplements.user_id
        AND up.clinician_user_id = auth.uid()
    )
  );

-- ── 6. RLS: clinician reads patient protocols ─────────────────
CREATE POLICY "clinician_reads_patient_protocols"
  ON protocols FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = protocols.user_id
        AND up.clinician_user_id = auth.uid()
    )
  );

-- ── 7. RLS: clinician reads patient daily_logs ────────────────
CREATE POLICY "clinician_reads_patient_logs"
  ON daily_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = daily_logs.user_id
        AND up.clinician_user_id = auth.uid()
    )
  );

-- ── 8. RLS: clinician reads patient user_schedule ────────────
CREATE POLICY "clinician_reads_patient_schedule"
  ON user_schedule FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = user_schedule.user_id
        AND up.clinician_user_id = auth.uid()
    )
  );

-- ── 9. Set Sofia as clinician ─────────────────────────────────
UPDATE user_profiles
SET is_clinician = true
WHERE id = '68848e43-3c43-4259-b4ff-bc4f8e3a37ab';
