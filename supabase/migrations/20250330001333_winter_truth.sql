/*
  # Fix Files Array Validation

  1. Changes
    - Drop existing constraint
    - Create function to validate file paths
    - Add new constraint for files array validation
    - Create GIN index for files array

  2. Security
    - Maintain data integrity
    - Ensure proper file path validation
*/

-- First, drop existing constraint if it exists
ALTER TABLE reports
DROP CONSTRAINT IF EXISTS files_array_size_check;

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

-- Create GIN index for files array if it doesn't exist
CREATE INDEX IF NOT EXISTS reports_files_gin_idx
ON reports USING GIN (files);

-- Add new constraint for files array validation
ALTER TABLE reports
ADD CONSTRAINT valid_files_array CHECK (validate_files_array(files));