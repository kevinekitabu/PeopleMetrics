-- First, drop existing constraints
ALTER TABLE reports
DROP CONSTRAINT IF EXISTS valid_files_array,
DROP CONSTRAINT IF EXISTS files_array_size_check;

-- Create a function to validate file paths
CREATE OR REPLACE FUNCTION validate_file_path(path text)
RETURNS boolean AS $$
BEGIN
  RETURN path ~ '^[a-f0-9\-]{36}/[0-9]+\-[a-zA-Z0-9\-_\.]+\.[a-zA-Z0-9]+$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a function to validate files array
CREATE OR REPLACE FUNCTION validate_files_array(files jsonb[])
RETURNS boolean AS $$
DECLARE
  file_obj jsonb;
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
  FOREACH file_obj IN ARRAY files
  LOOP
    IF file_obj->>'path' IS NULL OR NOT validate_file_path(file_obj->>'path') THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create GIN index for files array
CREATE INDEX IF NOT EXISTS reports_files_gin_idx
ON reports USING GIN (files);

-- Add size constraint
ALTER TABLE reports
ADD CONSTRAINT files_array_size_check CHECK (
  CASE
    WHEN files IS NULL THEN true
    ELSE array_length(files, 1) BETWEEN 0 AND 5
  END
);

-- Add validation constraint
ALTER TABLE reports
ADD CONSTRAINT valid_files_array CHECK (validate_files_array(files));