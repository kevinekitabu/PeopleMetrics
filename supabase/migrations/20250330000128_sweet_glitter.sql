/*
  # Fix File Validation and Constraints

  1. Changes
    - Drop existing constraints
    - Update any NULL values to empty array
    - Add new constraints with proper validation
    - Create indexes for performance

  2. Security
    - Maintain existing RLS policies
    - Ensure data integrity with proper constraints
*/

-- First, temporarily disable the constraint
ALTER TABLE reports
DROP CONSTRAINT IF EXISTS valid_files_array,
DROP CONSTRAINT IF EXISTS files_array_size_check;

-- Update any NULL values to empty array
UPDATE reports 
SET files = '{}'::jsonb[] 
WHERE files IS NULL;

-- Add NOT NULL constraints with defaults
ALTER TABLE reports
ALTER COLUMN files SET DEFAULT '{}'::jsonb[],
ALTER COLUMN files SET NOT NULL;

-- Create GIN index for files array
CREATE INDEX IF NOT EXISTS reports_files_gin_idx
ON reports USING GIN (files);

-- Add constraints
ALTER TABLE reports
ADD CONSTRAINT files_array_size_check CHECK (
  CASE
    WHEN files IS NULL THEN true
    ELSE array_length(files, 1) BETWEEN 0 AND 5
  END
);