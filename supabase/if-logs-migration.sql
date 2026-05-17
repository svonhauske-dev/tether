-- IF v2 daily_log key migration
-- Remaps checked JSONB keys in daily_logs for users who have migrated to IF v2.
-- Run once after all IF users have gone through IFMigrationScreen.
--
-- Old key format: {date}_{slot}_{supp_id}
-- Slot remap:
--   pre_breakfast → fasted
--   breakfast     → meal_1
--   pre_lunch     → pre_meal_2
--   lunch         → meal_2
--   pre_dinner    → pre_meal_3
--   dinner        → meal_3
--   after_dinner  → evening
--
-- NOTE: Order matters — longer prefixes must be replaced before shorter ones
-- to avoid double-substitution (e.g. pre_breakfast before breakfast).

WITH if_users AS (
  -- Only target users who have completed the IF v2 migration
  SELECT user_id
  FROM user_schedule
  WHERE schedule_type = 'fasting'
    AND offsets->>'_if_v2_migrated' = 'true'
),
logs_to_migrate AS (
  SELECT dl.id, dl.checked
  FROM daily_logs dl
  JOIN if_users iu ON dl.user_id = iu.user_id
  WHERE dl.checked IS NOT NULL
    AND dl.checked::text <> '{}'
    AND (
      dl.checked::text LIKE '%_pre_breakfast_%'
      OR dl.checked::text LIKE '%_breakfast_%'
      OR dl.checked::text LIKE '%_pre_lunch_%'
      OR dl.checked::text LIKE '%_lunch_%'
      OR dl.checked::text LIKE '%_pre_dinner_%'
      OR dl.checked::text LIKE '%_dinner_%'
      OR dl.checked::text LIKE '%_after_dinner_%'
    )
),
remapped AS (
  SELECT
    id,
    (
      SELECT jsonb_object_agg(
        -- Apply slot renames to each key. Order: longer patterns before shorter.
        CASE
          WHEN key LIKE '%_pre_breakfast_%' THEN regexp_replace(key, '_pre_breakfast_', '_fasted_')
          WHEN key LIKE '%_breakfast_%'     THEN regexp_replace(key, '_breakfast_',     '_meal_1_')
          WHEN key LIKE '%_pre_lunch_%'     THEN regexp_replace(key, '_pre_lunch_',     '_pre_meal_2_')
          WHEN key LIKE '%_lunch_%'         THEN regexp_replace(key, '_lunch_',         '_meal_2_')
          WHEN key LIKE '%_pre_dinner_%'    THEN regexp_replace(key, '_pre_dinner_',    '_pre_meal_3_')
          WHEN key LIKE '%_after_dinner_%'  THEN regexp_replace(key, '_after_dinner_',  '_evening_')
          WHEN key LIKE '%_dinner_%'        THEN regexp_replace(key, '_dinner_',        '_meal_3_')
          ELSE key
        END,
        value
      )
      FROM jsonb_each(checked)
    ) AS new_checked
  FROM logs_to_migrate
)
UPDATE daily_logs dl
SET checked = r.new_checked
FROM remapped r
WHERE dl.id = r.id;
