/*
  # Fix All Migration Errors - Cool Palace

  This migration fixes all the problematic constraints and indexes that are causing
  Supabase API errors:
  
  1. Removes constraints with subqueries (not allowed in PostgreSQL)
  2. Fixes JSONB array operator issues 
  3. Adds proper constraints without syntax errors
  4. Creates correct indexes for performance

  ## Changes Made
  - Drop problematic constraints that use subqueries
  - Fix JSONB array indexing issues  
  - Add simple, working constraints
  - Create proper performance indexes
*/

-- Drop any problematic constraints that might exist
DROP INDEX IF EXISTS reports_files_gin_idx;
DROP INDEX IF EXISTS reports_file_path_idx;

-- Remove any constraints that use subqueries or have syntax issues
ALTER TABLE reports DROP CONSTRAINT IF EXISTS valid_file_path;
ALTER TABLE reports DROP CONSTRAINT IF EXISTS files_array_size_check;
ALTER TABLE reports DROP CONSTRAINT IF EXISTS context_length_check;
ALTER TABLE reports DROP CONSTRAINT IF EXISTS regeneration_count_check;

-- Add proper constraints without subqueries
ALTER TABLE reports ADD CONSTRAINT files_array_size_check 
CHECK (
  CASE 
    WHEN files IS NULL THEN true
    ELSE array_length(files, 1) IS NULL OR (array_length(files, 1) >= 0 AND array_length(files, 1) <= 5)
  END
);

ALTER TABLE reports ADD CONSTRAINT context_length_check 
CHECK (length(COALESCE(context, '')) <= 100);

ALTER TABLE reports ADD CONSTRAINT regeneration_count_check 
CHECK (regeneration_count >= 0 AND regeneration_count <= 5);

-- Create proper GIN index for JSONB array (without field extraction)
CREATE INDEX IF NOT EXISTS reports_files_gin_idx ON reports USING GIN (files);

-- Add performance indexes
CREATE INDEX IF NOT EXISTS reports_user_id_created_idx ON reports (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_is_generating_user_idx ON reports (is_generating, user_id) WHERE is_generating = true;
CREATE INDEX IF NOT EXISTS reports_stop_requested_idx ON reports (stop_requested) WHERE stop_requested = true;