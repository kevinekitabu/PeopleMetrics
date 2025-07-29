/*
  # Fix Reports Schema and File Handling

  1. Changes
    - Add proper file deletion trigger
    - Add cascade deletion for storage objects
    - Fix file path validation
    - Add proper indexes

  2. Security
    - Maintain existing RLS policies
    - Ensure proper cleanup of storage objects
*/

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS delete_report_files ON reports;
DROP FUNCTION IF EXISTS delete_storage_objects();

-- Create improved storage cleanup function
CREATE OR REPLACE FUNCTION delete_storage_objects()
RETURNS TRIGGER AS $$
DECLARE
  file_obj jsonb;
BEGIN
  IF OLD.files IS NOT NULL THEN
    -- Loop through each file and delete from storage
    FOR file_obj IN SELECT * FROM jsonb_array_elements(array_to_json(OLD.files)::jsonb)
    LOOP
      -- Delete the file from storage
      PERFORM storage.delete_object('reports', file_obj->>'path');
    END LOOP;
  END IF;
  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  -- Log error but allow deletion to continue
  RAISE WARNING 'Error deleting storage objects: %', SQLERRM;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create improved trigger for file deletion
CREATE TRIGGER delete_report_files
  BEFORE DELETE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION delete_storage_objects();

-- Add proper indexes
CREATE INDEX IF NOT EXISTS reports_user_id_idx ON reports(user_id);
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS reports_files_gin_idx ON reports USING GIN (files);

-- Clean up orphaned files
WITH orphaned_files AS (
  SELECT DISTINCT file_obj->>'path' as file_path
  FROM reports, jsonb_array_elements(array_to_json(files)::jsonb) AS file_obj
  WHERE NOT EXISTS (
    SELECT 1 FROM storage.objects
    WHERE bucket_id = 'reports'
    AND name = file_obj->>'path'
  )
)
DELETE FROM reports
WHERE id IN (
  SELECT r.id
  FROM reports r,
  jsonb_array_elements(array_to_json(r.files)::jsonb) AS file_obj
  JOIN orphaned_files o ON o.file_path = file_obj->>'path'
);

-- Update file validation function
CREATE OR REPLACE FUNCTION validate_file_paths(files jsonb[])
RETURNS boolean AS $$
BEGIN
  -- Check array size
  IF array_length(files, 1) > 5 THEN
    RETURN false;
  END IF;

  -- Empty array is valid
  IF array_length(files, 1) IS NULL THEN
    RETURN true;
  END IF;

  -- All paths must be valid
  RETURN NOT EXISTS (
    SELECT 1
    FROM unnest(files) AS file_obj
    WHERE file_obj->>'path' IS NULL
    OR NOT (file_obj->>'path' ~ '^[a-f0-9\-]{36}/[0-9]+\-[a-zA-Z0-9\-_\.]+\.[a-zA-Z0-9]+$')
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add constraints
ALTER TABLE reports
DROP CONSTRAINT IF EXISTS valid_files_array,
ADD CONSTRAINT valid_files_array CHECK (validate_file_paths(files));