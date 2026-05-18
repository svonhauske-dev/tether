-- ============================================================
-- ORIGIN DEMO SEED — Patient Data
-- Run in this order:
--   1. supabase/demo-setup.sql   (schema + RLS + clinician flag)
--   2. supabase/add-protocol-source.sql  (source column on protocols)
--   3. THIS FILE  (patient profiles, supplements, logs)
--
-- HOW TO CREATE PATIENT ACCOUNTS (do this before running):
--   Supabase Dashboard → Authentication → Users → Add user
--   Or: use sign-up flow at origin-protocol.vercel.app
--
--   Suggested emails (any password, e.g. Demo2026!):
--     alex@origin-demo.com
--     maria@origin-demo.com
--     jordan@origin-demo.com
--     priya@origin-demo.com
--
-- Then paste their UUIDs in the DECLARE block below.
-- This script is safe to re-run (uses ON CONFLICT DO UPDATE).
-- ============================================================

DO $$
DECLARE
  sofia_id   uuid := '68848e43-3c43-4259-b4ff-bc4f8e3a37ab';
  alex_id    uuid := 'PASTE-ALEX-UUID-HERE';
  maria_id   uuid := 'PASTE-MARIA-UUID-HERE';
  jordan_id  uuid := 'PASTE-JORDAN-UUID-HERE';
  priya_id   uuid := 'PASTE-PRIYA-UUID-HERE';

  alex_proto   uuid := gen_random_uuid();
  maria_proto  uuid := gen_random_uuid();
  jordan_proto uuid := gen_random_uuid();
  priya_proto  uuid := gen_random_uuid();

  today        date := current_date;
  supp_row     RECORD;
  slot_name    text;
  log_checked  jsonb;
  log_date_val date;
  day_offset   int;

BEGIN

-- ── 1. Patient profiles ───────────────────────────────────────
-- shares_adherence_with_clinician = true so the clinician demo
-- view shows full data without each demo patient having to flip
-- the toggle. Real users default to false (opt-in).
INSERT INTO user_profiles (id, display_name, is_clinician, clinician_user_id, shares_adherence_with_clinician)
VALUES
  (alex_id,   'Alex Chen',    false, sofia_id, true),
  (maria_id,  'Maria Santos', false, sofia_id, true),
  (jordan_id, 'Jordan Kim',   false, sofia_id, true),
  (priya_id,  'Priya Patel',  false, sofia_id, true)
ON CONFLICT (id) DO UPDATE SET
  display_name                    = EXCLUDED.display_name,
  clinician_user_id               = EXCLUDED.clinician_user_id,
  shares_adherence_with_clinician = EXCLUDED.shares_adherence_with_clinician;

-- ── 2. User schedules (none = no scheduling complexity) ───────
INSERT INTO user_schedule (user_id, schedule_type)
VALUES
  (alex_id,   'none'),
  (maria_id,  'none'),
  (jordan_id, 'none'),
  (priya_id,  'none')
ON CONFLICT (user_id) DO UPDATE SET schedule_type = EXCLUDED.schedule_type;

-- ── 3. Protocols ──────────────────────────────────────────────
INSERT INTO protocols (id, user_id, name, status, treatment_mode)
VALUES
  (alex_proto,   alex_id,   'Foundation Protocol', 'active', 'indefinite'),
  (maria_proto,  maria_id,  'Foundation Protocol', 'active', 'indefinite'),
  (jordan_proto, jordan_id, 'Foundation Protocol', 'active', 'indefinite'),
  (priya_proto,  priya_id,  'Foundation Protocol', 'active', 'indefinite')
ON CONFLICT (id) DO NOTHING;

-- ── 4. Supplements ────────────────────────────────────────────

-- Alex Chen — High Adherer (7 supplements)
INSERT INTO supplements (user_id, protocol_id, name, dose, slots, days, category, status, paused, treatment_mode)
VALUES
  (alex_id, alex_proto, 'Magnesium Glycinate', '400 mg',  ARRAY['dinner'],           ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite'),
  (alex_id, alex_proto, 'Vitamin D3 + K2',     '5000 IU', ARRAY['breakfast'],         ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite'),
  (alex_id, alex_proto, 'Omega-3',             '2 g',     ARRAY['breakfast'],         ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite'),
  (alex_id, alex_proto, 'Ashwagandha',         '600 mg',  ARRAY['dinner'],            ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite'),
  (alex_id, alex_proto, 'Zinc',                '30 mg',   ARRAY['dinner'],            ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite'),
  (alex_id, alex_proto, 'B-Complex',           '1 cap',   ARRAY['breakfast'],         ARRAY[1,2,3,4,5],     'Oral', 'active', false, 'indefinite'),
  (alex_id, alex_proto, 'CoQ10',               '200 mg',  ARRAY['breakfast'],         ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite')
ON CONFLICT DO NOTHING;

-- Maria Santos — At Risk (5 supplements)
INSERT INTO supplements (user_id, protocol_id, name, dose, slots, days, category, status, paused, treatment_mode)
VALUES
  (maria_id, maria_proto, 'Magnesium Glycinate', '300 mg',  ARRAY['dinner'],           ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite'),
  (maria_id, maria_proto, 'Vitamin D3',          '2000 IU', ARRAY['breakfast'],         ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite'),
  (maria_id, maria_proto, 'Iron',                '18 mg',   ARRAY['breakfast'],         ARRAY[1,3,5],         'Oral', 'active', false, 'indefinite'),
  (maria_id, maria_proto, 'Folate',              '400 mcg', ARRAY['breakfast'],         ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite'),
  (maria_id, maria_proto, 'Berberine',           '500 mg',  ARRAY['lunch','dinner'],    ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite')
ON CONFLICT DO NOTHING;

-- Jordan Kim — Recently Stopped (3 active, 2 stopped)
INSERT INTO supplements (user_id, protocol_id, name, dose, slots, days, category, status, paused, treatment_mode, stopped_at)
VALUES
  (jordan_id, jordan_proto, 'Vitamin C',           '1000 mg', ARRAY['breakfast'], ARRAY[0,1,2,3,4,5,6], 'Oral', 'active',  false, 'indefinite', null),
  (jordan_id, jordan_proto, 'Magnesium Glycinate', '400 mg',  ARRAY['dinner'],    ARRAY[0,1,2,3,4,5,6], 'Oral', 'active',  false, 'indefinite', null),
  (jordan_id, jordan_proto, 'Zinc',                '15 mg',   ARRAY['dinner'],    ARRAY[0,1,2,3,4,5,6], 'Oral', 'active',  false, 'indefinite', null),
  (jordan_id, jordan_proto, 'Ashwagandha',         '500 mg',  ARRAY['dinner'],    ARRAY[0,1,2,3,4,5,6], 'Oral', 'stopped', false, 'indefinite', today - 8),
  (jordan_id, jordan_proto, 'Melatonin',           '3 mg',    ARRAY['dinner'],    ARRAY[0,1,2,3,4,5,6], 'Oral', 'stopped', false, 'indefinite', today - 3)
ON CONFLICT DO NOTHING;

-- Priya Patel — New (3 supplements, 8 days in)
INSERT INTO supplements (user_id, protocol_id, name, dose, slots, days, category, status, paused, treatment_mode)
VALUES
  (priya_id, priya_proto, 'Vitamin D3',          '4000 IU', ARRAY['breakfast'], ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite'),
  (priya_id, priya_proto, 'Magnesium Glycinate', '300 mg',  ARRAY['dinner'],    ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite'),
  (priya_id, priya_proto, 'Omega-3',             '1 g',     ARRAY['breakfast'], ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite')
ON CONFLICT DO NOTHING;

-- ── 5. Daily logs ─────────────────────────────────────────────
-- Historical days use {"all": true} for adherence ring display.
-- Today's log uses real supplement key format so PatientDetailPanel
-- shows checked supplements correctly.

-- Alex — 13 past days at ~92% (miss day 7), today fully checked
FOR day_offset IN 1..13 LOOP
  INSERT INTO daily_logs (user_id, log_date, checked)
  VALUES (
    alex_id,
    today - day_offset,
    CASE WHEN day_offset = 7 THEN '{}'::jsonb ELSE '{"all": true}'::jsonb END
  )
  ON CONFLICT (user_id, log_date) DO UPDATE SET checked = EXCLUDED.checked;
END LOOP;

-- Alex today: real supplement keys
log_checked := '{}'::jsonb;
FOR supp_row IN
  SELECT id, slots FROM supplements WHERE user_id = alex_id AND status = 'active'
LOOP
  FOREACH slot_name IN ARRAY supp_row.slots LOOP
    log_checked := log_checked || jsonb_build_object(
      to_char(today, 'YYYY-MM-DD') || '_' || slot_name || '_' || supp_row.id::text, true
    );
  END LOOP;
END LOOP;
INSERT INTO daily_logs (user_id, log_date, checked)
VALUES (alex_id, today, log_checked)
ON CONFLICT (user_id, log_date) DO UPDATE SET checked = EXCLUDED.checked;

-- Maria — ~55% adherence (misses about half the days)
FOR day_offset IN 0..13 LOOP
  INSERT INTO daily_logs (user_id, log_date, checked)
  VALUES (
    maria_id,
    today - day_offset,
    CASE WHEN day_offset IN (0, 2, 4, 7, 9, 11, 13)
      THEN '{"all": true}'::jsonb
      ELSE '{}'::jsonb
    END
  )
  ON CONFLICT (user_id, log_date) DO UPDATE SET checked = EXCLUDED.checked;
END LOOP;

-- Jordan — was consistent, dropped off last 4 days (after stops)
FOR day_offset IN 0..13 LOOP
  INSERT INTO daily_logs (user_id, log_date, checked)
  VALUES (
    jordan_id,
    today - day_offset,
    CASE WHEN day_offset <= 3
      THEN '{}'::jsonb
      ELSE '{"all": true}'::jsonb
    END
  )
  ON CONFLICT (user_id, log_date) DO UPDATE SET checked = EXCLUDED.checked;
END LOOP;

-- Priya — new, only 8 days of history, all checked
-- Today: real supplement keys so detail view looks right
log_checked := '{}'::jsonb;
FOR supp_row IN
  SELECT id, slots FROM supplements WHERE user_id = priya_id AND status = 'active'
LOOP
  FOREACH slot_name IN ARRAY supp_row.slots LOOP
    log_checked := log_checked || jsonb_build_object(
      to_char(today, 'YYYY-MM-DD') || '_' || slot_name || '_' || supp_row.id::text, true
    );
  END LOOP;
END LOOP;
INSERT INTO daily_logs (user_id, log_date, checked)
VALUES (priya_id, today, log_checked)
ON CONFLICT (user_id, log_date) DO UPDATE SET checked = EXCLUDED.checked;

FOR day_offset IN 1..7 LOOP
  INSERT INTO daily_logs (user_id, log_date, checked)
  VALUES (priya_id, today - day_offset, '{"all": true}'::jsonb)
  ON CONFLICT (user_id, log_date) DO UPDATE SET checked = EXCLUDED.checked;
END LOOP;

END $$;
