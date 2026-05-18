-- ============================================================
-- ORIGIN CLINICIAN NOTES + ARCHIVE MIGRATION (Phase 4)
--
-- Adds:
--   • clinician_patient_notes table — clinician-owned private notes
--     about a specific patient, plus archived_at for roster declutter.
--   • RLS that makes the table invisible to the patient. The patient
--     never sees the notes their clinician keeps about them.
--
-- Why a new table instead of columns on user_profiles?
--   Postgres RLS is row-level, not column-level. If notes/archive lived
--   on user_profiles, the patient (who owns their profile row) could
--   read them via direct query. Owning the table on the clinician side
--   is the only way to keep notes truly private.
--
-- The existing user_profiles.archived_by_clinician_at column (added in
-- the earlier clinician-link migration) is deprecated by this change.
-- It's left in place to avoid a destructive ALTER; nothing writes to
-- it anymore.
--
-- Safe to re-run: every statement idempotent.
-- Transactional: BEGIN/COMMIT wraps everything.
--
-- Run via:
--   supabase db query --linked -f supabase/clinician-notes-migration.sql
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS clinician_patient_notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinician_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notes         text NOT NULL DEFAULT '',
  archived_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS clinician_patient_notes_pair_unique
  ON clinician_patient_notes (clinician_id, patient_id);

ALTER TABLE clinician_patient_notes ENABLE ROW LEVEL SECURITY;

-- Only the owning clinician can read/write their own rows. The patient
-- has no policy granting access — they cannot see this table at all.
DROP POLICY IF EXISTS clinician_owns_notes ON clinician_patient_notes;
CREATE POLICY clinician_owns_notes
  ON clinician_patient_notes FOR ALL TO authenticated
  USING  (clinician_id = auth.uid())
  WITH CHECK (clinician_id = auth.uid());

-- Auto-bump updated_at on UPDATE.
CREATE OR REPLACE FUNCTION clinician_patient_notes_touch()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clinician_patient_notes_touch ON clinician_patient_notes;
CREATE TRIGGER clinician_patient_notes_touch
  BEFORE UPDATE ON clinician_patient_notes
  FOR EACH ROW EXECUTE FUNCTION clinician_patient_notes_touch();

COMMIT;
