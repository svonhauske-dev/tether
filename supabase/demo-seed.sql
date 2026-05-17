-- ============================================================
-- ORIGIN DEMO SEED — Phase 0: Patient Data
-- Run AFTER creating the 4 patient accounts in Supabase Auth
-- and filling in their UUIDs below.
--
-- HOW TO CREATE PATIENT ACCOUNTS:
--   Option A: Use the app's sign-up flow at origin-protocol.vercel.app
--   Option B: Supabase Dashboard → Authentication → Users → Add user
--
-- Suggested accounts (use any password, e.g. Demo2026!):
--   alex@origin-demo.com
--   maria@origin-demo.com
--   jordan@origin-demo.com
--   priya@origin-demo.com
--
-- After creating, paste their UUIDs in the variables below.
-- ============================================================

-- ── FILL THESE IN ────────────────────────────────────────────
DO $$
DECLARE
  sofia_id   uuid := '68848e43-3c43-4259-b4ff-bc4f8e3a37ab';
  alex_id    uuid := 'PASTE-ALEX-UUID-HERE';
  maria_id   uuid := 'PASTE-MARIA-UUID-HERE';
  jordan_id  uuid := 'PASTE-JORDAN-UUID-HERE';
  priya_id   uuid := 'PASTE-PRIYA-UUID-HERE';

  -- Protocol IDs (generated fresh)
  alex_proto   uuid := gen_random_uuid();
  maria_proto  uuid := gen_random_uuid();
  jordan_proto uuid := gen_random_uuid();
  priya_proto  uuid := gen_random_uuid();

  today date := current_date;
BEGIN

-- ── Patient profiles ─────────────────────────────────────────
INSERT INTO user_profiles (id, display_name, is_clinician, clinician_user_id)
VALUES
  (alex_id,   'Alex Chen',    false, sofia_id),
  (maria_id,  'Maria Santos', false, sofia_id),
  (jordan_id, 'Jordan Kim',   false, sofia_id),
  (priya_id,  'Priya Patel',  false, sofia_id)
ON CONFLICT (id) DO UPDATE SET
  display_name      = EXCLUDED.display_name,
  clinician_user_id = EXCLUDED.clinician_user_id;

-- ── User schedules ────────────────────────────────────────────
INSERT INTO user_schedule (user_id, schedule_type)
VALUES
  (alex_id,   'medication'),
  (maria_id,  'medication'),
  (jordan_id, 'fixed'),
  (priya_id,  'medication')
ON CONFLICT (user_id) DO NOTHING;

-- ── Foundation protocols ──────────────────────────────────────
INSERT INTO protocols (id, user_id, name, status, treatment_mode)
VALUES
  (alex_proto,   alex_id,   'Foundation Protocol', 'active', 'indefinite'),
  (maria_proto,  maria_id,  'Foundation Protocol', 'active', 'indefinite'),
  (jordan_proto, jordan_id, 'Foundation Protocol', 'active', 'indefinite'),
  (priya_proto,  priya_id,  'Foundation Protocol', 'active', 'indefinite');

-- ── Alex Chen — High Adherer (7 supplements) ─────────────────
INSERT INTO supplements (user_id, protocol_id, name, dose, slots, days, category, status, paused, treatment_mode)
VALUES
  (alex_id, alex_proto, 'Magnesium Glycinate', '400 mg', ARRAY['dinner'], ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite'),
  (alex_id, alex_proto, 'Vitamin D3 + K2',    '5000 IU', ARRAY['breakfast'], ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite'),
  (alex_id, alex_proto, 'Omega-3',             '2 g',    ARRAY['breakfast'], ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite'),
  (alex_id, alex_proto, 'Ashwagandha',         '600 mg', ARRAY['dinner'], ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite'),
  (alex_id, alex_proto, 'Zinc',                '30 mg',  ARRAY['dinner'], ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite'),
  (alex_id, alex_proto, 'B-Complex',           '1 cap',  ARRAY['breakfast'], ARRAY[1,2,3,4,5], 'Oral', 'active', false, 'indefinite'),
  (alex_id, alex_proto, 'CoQ10',               '200 mg', ARRAY['breakfast'], ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite');

-- ── Maria Santos — At Risk (5 supplements, recent gaps in logs) ──
INSERT INTO supplements (user_id, protocol_id, name, dose, slots, days, category, status, paused, treatment_mode)
VALUES
  (maria_id, maria_proto, 'Magnesium Glycinate', '300 mg', ARRAY['dinner'],    ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite'),
  (maria_id, maria_proto, 'Vitamin D3',          '2000 IU', ARRAY['breakfast'], ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite'),
  (maria_id, maria_proto, 'Iron',                '18 mg',  ARRAY['breakfast'], ARRAY[1,3,5], 'Oral', 'active', false, 'indefinite'),
  (maria_id, maria_proto, 'Folate',              '400 mcg', ARRAY['breakfast'], ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite'),
  (maria_id, maria_proto, 'Berberine',           '500 mg', ARRAY['lunch','dinner'], ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite');

-- ── Jordan Kim — Recently Stopped (3 active, 2 stopped) ──────
INSERT INTO supplements (user_id, protocol_id, name, dose, slots, days, category, status, paused, treatment_mode, stopped_at)
VALUES
  (jordan_id, jordan_proto, 'Vitamin C',          '1000 mg', ARRAY['breakfast'], ARRAY[0,1,2,3,4,5,6], 'Oral', 'active',  false, 'indefinite', null),
  (jordan_id, jordan_proto, 'Magnesium Glycinate', '400 mg', ARRAY['dinner'],    ARRAY[0,1,2,3,4,5,6], 'Oral', 'active',  false, 'indefinite', null),
  (jordan_id, jordan_proto, 'Zinc',               '15 mg',   ARRAY['dinner'],    ARRAY[0,1,2,3,4,5,6], 'Oral', 'active',  false, 'indefinite', null),
  (jordan_id, jordan_proto, 'Ashwagandha',        '500 mg',  ARRAY['dinner'],    ARRAY[0,1,2,3,4,5,6], 'Oral', 'stopped', false, 'indefinite', today - 8),
  (jordan_id, jordan_proto, 'Melatonin',          '3 mg',    ARRAY['dinner'],    ARRAY[0,1,2,3,4,5,6], 'Oral', 'stopped', false, 'indefinite', today - 3);

-- ── Priya Patel — New to protocol (3 supplements, 8 days in) ─
INSERT INTO supplements (user_id, protocol_id, name, dose, slots, days, category, status, paused, treatment_mode, starts_at)
VALUES
  (priya_id, priya_proto, 'Vitamin D3',         '4000 IU', ARRAY['breakfast'], ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite', null),
  (priya_id, priya_proto, 'Magnesium Glycinate', '300 mg', ARRAY['dinner'],    ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite', null),
  (priya_id, priya_proto, 'Omega-3',            '1 g',     ARRAY['breakfast'], ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite', null);

-- ── Daily logs: Alex — high adherence (~90%+ last 14 days) ───
-- Using a loop to seed 14 days of logs
-- Alex checks everything every day except one miss on day 7
INSERT INTO daily_logs (user_id, log_date, checked)
SELECT
  alex_id,
  today - n,
  CASE WHEN n = 7
    THEN '{}'::jsonb
    ELSE '{"all": true}'::jsonb
  END
FROM generate_series(0, 13) AS n
ON CONFLICT (user_id, log_date) DO NOTHING;

-- ── Daily logs: Maria — at risk (~55% last 14 days) ──────────
-- Maria misses about half the days
INSERT INTO daily_logs (user_id, log_date, checked)
SELECT
  maria_id,
  today - n,
  CASE WHEN n IN (0, 2, 4, 7, 9, 11)
    THEN '{"all": true}'::jsonb
    ELSE '{}'::jsonb
  END
FROM generate_series(0, 13) AS n
ON CONFLICT (user_id, log_date) DO NOTHING;

-- ── Daily logs: Jordan — recent stop context ──────────────────
INSERT INTO daily_logs (user_id, log_date, checked)
SELECT
  jordan_id,
  today - n,
  CASE WHEN n <= 3
    THEN '{}'::jsonb   -- stopped taking things recently
    ELSE '{"all": true}'::jsonb
  END
FROM generate_series(0, 13) AS n
ON CONFLICT (user_id, log_date) DO NOTHING;

-- ── Daily logs: Priya — new, only 8 days of data ─────────────
INSERT INTO daily_logs (user_id, log_date, checked)
SELECT
  priya_id,
  today - n,
  '{"all": true}'::jsonb
FROM generate_series(0, 7) AS n
ON CONFLICT (user_id, log_date) DO NOTHING;

END $$;
