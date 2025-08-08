/*
  # Fix Files Array in Reports Table

  1. Changes
    - Drop existing constraints
    - Update NULL values to empty array
    - Add NOT NULL constraint with default
    - Add size constraint
    - Create GIN index for better performance

  2. Security
    - Maintain existing RLS policies
    - Ensure data integrity during migration
*/

-- First, drop existing constraints
ALTER TABLE reports
DROP CONSTRAINT IF EXISTS valid_files_array,
DROP CONSTRAINT IF EXISTS files_array_size_check;

-- Create a temporary table for reports with invalid files
CREATE TEMP TABLE invalid_reports AS
SELECT id, files
FROM reports
WHERE files IS NULL 
   OR NOT jsonb_typeof(files) = 'array'
   OR jsonb_array_length(files) > 5;

-- Log invalid reports for review
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count FROM invalid_reports;
  IF invalid_count > 0 THEN
    RAISE NOTICE 'Found % reports with invalid files array', invalid_count;
  END IF;
END $$;

-- Update any NULL or invalid values to empty array
UPDATE reports 
SET files = '[]'::jsonb
FROM invalid_reports
WHERE reports.id = invalid_reports.id;

-- Add NOT NULL constraint with default
ALTER TABLE reports
ALTER COLUMN files SET DEFAULT '[]'::jsonb,
ALTER COLUMN files SET NOT NULL;

-- Create GIN index for files array
CREATE INDEX IF NOT EXISTS reports_files_gin_idx
ON reports USING GIN (files);

-- Add size constraint using jsonb_array_length
ALTER TABLE reports
ADD CONSTRAINT files_array_size_check CHECK (
  jsonb_array_length(files) BETWEEN 0 AND 5
);

-- Drop temporary table
DROP TABLE invalid_reports;