-- Add source column to protocols table
-- Run in Supabase SQL Editor:
-- https://app.supabase.com/project/yahimlivfieuknagusxp/sql/new

ALTER TABLE protocols
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'user'
  CHECK (source IN ('user', 'clinician'));
