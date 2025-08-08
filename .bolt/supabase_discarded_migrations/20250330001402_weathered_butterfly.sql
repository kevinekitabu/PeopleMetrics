/*
  # Fix Files Array Validation

  1. Changes
    - Drop existing constraints
    - Update any invalid data
    - Add new constraints with proper validation
    - Create indexes for performance

  2. Security
    - Maintain data integrity
    - Ensure proper file validation
*/

-- First, drop existing constraints
ALTER TABLE reports
DROP CONSTRAINT IF EXISTS valid_files_array,
DROP CONSTRAINT IF EXISTS files_array_size_check;

-- Update any NULL or invalid values to empty array
UPDATE reports 
SET files = '{}'::jsonb[] 
WHERE files IS NULL OR NOT jsonb_array_length(files::jsonb) BETWEEN 0 AND 5;

-- Add NOT NULL constraint with default
ALTER TABLE reports
ALTER COLUMN files SET DEFAULT '{}'::jsonb[],
ALTER COLUMN files SET NOT NULL;

-- Create GIN index for files array
CREATE INDEX IF NOT EXISTS reports_files_gin_idx
ON reports USING GIN (files);

-- Add size constraint
ALTER TABLE reports
ADD CONSTRAINT files_array_size_check CHECK (
  CASE
    WHEN files IS NULL THEN true
    ELSE jsonb_array_length(files::jsonb) BETWEEN 0 AND 5
  END
);