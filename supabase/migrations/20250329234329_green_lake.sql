/*
  # Update reports table structure

  1. Changes
    - Remove file_path column
    - Add files array constraints
    - Add file path validation function
    - Add trigger for file path validation

  2. Security
    - Maintain data integrity
    - Validate file paths
*/

-- Create function to validate file paths
CREATE OR REPLACE FUNCTION validate_file_paths(files jsonb[])
RETURNS boolean AS $$
DECLARE
  file_obj jsonb;
  path text;
BEGIN
  -- Return true for empty array
  IF array_length(files, 1) IS NULL THEN
    RETURN true;
  END IF;

  -- Check array size
  IF array_length(files, 1) > 5 THEN
    RETURN false;
  END IF;

  -- Check each file path
  FOREACH file_obj IN ARRAY files
  LOOP
    -- Extract path
    path := file_obj->>'path';
    
    -- Validate path format
    IF path IS NULL OR NOT (
      path ~ '^[a-f0-9\-]{36}/[a-f0-9\-]{36}/[0-9]+\-[a-zA-Z0-9\-_\.]+\.[a-zA-Z0-9]+$'
    ) THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Remove file_path column and its constraints
ALTER TABLE reports
DROP COLUMN IF EXISTS file_path;

-- Add check constraint for files array
ALTER TABLE reports
ADD CONSTRAINT valid_files_array
CHECK (validate_file_paths(files));