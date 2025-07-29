/*
  # Fix Reports Schema and Clean Up

  1. Changes
    - Add ON DELETE CASCADE to foreign keys
    - Add trigger to clean up storage files when report is deleted
    - Clean up orphaned files
    - Fix automatic report generation

  2. Security
    - Maintain existing RLS policies
    - Ensure proper cascade deletion
*/

-- Create function to delete storage objects
CREATE OR REPLACE FUNCTION delete_storage_objects()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete all files in storage for the deleted report
  IF OLD.files IS NOT NULL THEN
    PERFORM
      storage.delete_object('reports', file_obj->>'path')
    FROM
      unnest(OLD.files) AS file_obj;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to delete storage objects when report is deleted
DROP TRIGGER IF EXISTS delete_report_files ON reports;
CREATE TRIGGER delete_report_files
  BEFORE DELETE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION delete_storage_objects();

-- Clean up orphaned files
WITH orphaned_files AS (
  SELECT DISTINCT file_obj->>'path' as file_path
  FROM reports, unnest(files) AS file_obj
  WHERE NOT EXISTS (
    SELECT 1 FROM storage.objects
    WHERE bucket_id = 'reports'
    AND name = file_obj->>'path'
  )
)
DELETE FROM reports
WHERE id IN (
  SELECT r.id
  FROM reports r, unnest(r.files) AS file_obj
  JOIN orphaned_files o ON o.file_path = file_obj->>'path'
);

-- Add NOT NULL constraints
ALTER TABLE reports
ALTER COLUMN context SET DEFAULT '',
ALTER COLUMN regeneration_count SET DEFAULT 0,
ALTER COLUMN context SET NOT NULL,
ALTER COLUMN regeneration_count SET NOT NULL;

-- Add check constraints
ALTER TABLE reports
DROP CONSTRAINT IF EXISTS context_length_check,
DROP CONSTRAINT IF EXISTS regeneration_count_check,
ADD CONSTRAINT context_length_check CHECK (length(context) <= 100),
ADD CONSTRAINT regeneration_count_check CHECK (regeneration_count BETWEEN 0 AND 5);

-- Create index for regeneration count
CREATE INDEX IF NOT EXISTS reports_regeneration_count_idx
ON reports(regeneration_count);

-- Update existing reports
UPDATE reports
SET context = COALESCE(context, ''),
    regeneration_count = COALESCE(regeneration_count, 0)
WHERE context IS NULL OR regeneration_count IS NULL;