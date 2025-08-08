/*
  # Fix File Validation and Constraints

  1. Changes
    - Drop existing constraints
    - Add new columns with proper defaults
    - Create function for file validation
    - Add constraints with proper validation
    - Create indexes for performance

  2. Security
    - Maintain existing RLS policies
    - Ensure data integrity with proper constraints
*/

-- First, temporarily disable the constraint
ALTER TABLE reports
DROP CONSTRAINT IF EXISTS valid_files_array;

-- Update any NULL values to empty array
UPDATE reports 
SET files = '{}'::jsonb[] 
WHERE files IS NULL;

-- Create function to validate file paths (must be IMMUTABLE)
CREATE OR REPLACE FUNCTION validate_file_path(path text)
RETURNS boolean AS $$
BEGIN
  RETURN path ~ '^[a-f0-9\-]{36}/[0-9]+\-[a-zA-Z0-9\-_\.]+\.[a-zA-Z0-9]+$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to validate files array (must be IMMUTABLE)
CREATE OR REPLACE FUNCTION validate_files_array(files jsonb[])
RETURNS boolean AS $$
BEGIN
  -- Empty array is valid
  IF array_length(files, 1) IS NULL THEN
    RETURN true;
  END IF;

  -- Check array size
  IF array_length(files, 1) > 5 THEN
    RETURN false;
  END IF;

  -- Check each file path
  RETURN NOT EXISTS (
    SELECT 1
    FROM unnest(files) AS file_obj
    WHERE file_obj->>'path' IS NULL
       OR NOT validate_file_path(file_obj->>'path')
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

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
),
ADD CONSTRAINT valid_files_array CHECK (validate_files_array(files));