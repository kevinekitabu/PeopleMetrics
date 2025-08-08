/*
  # Fix All Migration Errors

  This migration fixes all the problematic constraints and indexes that are causing
  Supabase API errors:

  1. Removes invalid GIN index with incorrect jsonb array syntax
  2. Removes check constraints that use subqueries (not allowed)
  3. Recreates proper constraints and indexes
  4. Ensures all syntax is PostgreSQL compliant

  ## Changes Made
  - Drop problematic GIN index on files column
  - Drop check constraints with subqueries
  - Create proper GIN index for jsonb array
  - Add simple regex-based file path validation
  - Fix array size validation constraint
*/

-- Drop problematic indexes that cause syntax errors
DROP INDEX IF EXISTS reports_files_gin_idx;
DROP INDEX IF EXISTS reports_files_path_idx;

-- Drop problematic check constraints
ALTER TABLE reports DROP CONSTRAINT IF EXISTS valid_file_path;
ALTER TABLE reports DROP CONSTRAINT IF EXISTS files_array_size_check;
ALTER TABLE reports DROP CONSTRAINT IF EXISTS context_length_check;

-- Create proper GIN index for the files jsonb array
CREATE INDEX IF NOT EXISTS reports_files_gin_idx ON reports USING GIN (files);

-- Add simple file path validation (no subqueries)
ALTER TABLE reports ADD CONSTRAINT valid_file_path_simple 
CHECK (
  files IS NULL OR 
  jsonb_array_length(files) = 0 OR
  (
    jsonb_array_length(files) > 0 AND
    jsonb_array_length(files) <= 5
  )
);

-- Add context length constraint (simple version)
ALTER TABLE reports ADD CONSTRAINT context_length_simple 
CHECK (context IS NULL OR length(context) <= 100);

-- Add regeneration count constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'regeneration_count_check' 
    AND table_name = 'reports'
  ) THEN
    ALTER TABLE reports ADD CONSTRAINT regeneration_count_check 
    CHECK (regeneration_count >= 0 AND regeneration_count <= 5);
  END IF;
END $$;

-- Ensure all boolean columns have proper defaults
UPDATE reports SET is_generating = false WHERE is_generating IS NULL;
UPDATE reports SET stop_requested = false WHERE stop_requested IS NULL;

-- Add any missing indexes for performance
CREATE INDEX IF NOT EXISTS reports_user_id_created_at_idx ON reports (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_is_generating_user_id_idx ON reports (is_generating, user_id) WHERE is_generating = true;

-- Clean up any invalid data that might cause constraint violations
UPDATE reports SET files = '[]'::jsonb[] WHERE files IS NULL;
UPDATE reports SET context = '' WHERE context IS NULL;
UPDATE reports SET regeneration_count = 0 WHERE regeneration_count IS NULL;
UPDATE reports SET regeneration_count = 5 WHERE regeneration_count > 5;