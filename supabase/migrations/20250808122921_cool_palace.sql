/*
  # Fix JSONB Array Operator Errors

  This migration fixes all the JSONB array operator errors by:
  1. Removing problematic indexes that use incorrect operators on jsonb[] types
  2. Creating proper indexes for jsonb[] arrays
  3. Fixing all constraint issues
  4. Ensuring proper data types and operators are used

  ## Changes Made
  - Drop problematic GIN indexes on files column
  - Create proper GIN index for jsonb[] array
  - Fix all constraint syntax errors
  - Add proper validation constraints
*/

-- Drop all problematic indexes and constraints first
DROP INDEX IF EXISTS reports_files_gin_idx;
DROP INDEX IF EXISTS reports_files_path_idx;
DROP INDEX IF EXISTS idx_reports_files_path;

-- Drop problematic constraints
ALTER TABLE reports DROP CONSTRAINT IF EXISTS files_array_size_check;
ALTER TABLE reports DROP CONSTRAINT IF EXISTS valid_file_path;
ALTER TABLE reports DROP CONSTRAINT IF EXISTS context_length_check;
ALTER TABLE reports DROP CONSTRAINT IF EXISTS regeneration_count_check;

-- Create a proper GIN index for the jsonb[] array
-- This allows efficient searching within the array elements
CREATE INDEX IF NOT EXISTS reports_files_gin_idx 
ON reports USING GIN (files);

-- Add simple, working constraints
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

-- Create additional useful indexes
CREATE INDEX IF NOT EXISTS reports_user_id_created_at_idx 
ON reports (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reports_is_generating_idx 
ON reports (is_generating) WHERE is_generating = true;

CREATE INDEX IF NOT EXISTS reports_stop_requested_idx 
ON reports (stop_requested) WHERE stop_requested = true;