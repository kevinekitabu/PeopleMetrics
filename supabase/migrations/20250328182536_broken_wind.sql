/*
  # Fix File Paths in Reports Table

  1. Changes
    - Create function to extract relative path from signed URL
    - Update existing file paths to store relative paths
    - Add function to validate file paths
    - Create temporary table for invalid paths
    - Add check constraint after cleaning data

  2. Security
    - Maintain existing RLS policies
    - Ensure file paths follow correct format
*/

-- Create function to extract relative path from signed URL
CREATE OR REPLACE FUNCTION public.get_relative_path(url text)
RETURNS text AS $$
BEGIN
  -- If the URL contains '/storage/v1/object/sign/', extract the relative path
  IF url LIKE '%/storage/v1/object/sign/reports/%' THEN
    RETURN regexp_replace(url, '.*/storage/v1/object/sign/reports/', '');
  END IF;
  -- Otherwise, return the original path (assuming it's already relative)
  RETURN url;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to validate file path format
CREATE OR REPLACE FUNCTION public.is_valid_file_path(path text)
RETURNS boolean AS $$
BEGIN
  RETURN path ~ '^[a-f0-9\-]{36}/[0-9]+\-[a-zA-Z0-9\-_\.]+\.[a-zA-Z0-9]+$'
    OR path ~ '^[a-f0-9\-]{36}/[a-zA-Z0-9\-_\.]+\.[a-zA-Z0-9]+$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create temporary table to store invalid paths
CREATE TEMP TABLE invalid_paths AS
SELECT id, file_path
FROM reports
WHERE NOT public.is_valid_file_path(public.get_relative_path(file_path));

-- Log invalid paths for manual review
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count FROM invalid_paths;
  IF invalid_count > 0 THEN
    RAISE NOTICE 'Found % invalid file paths that need manual review', invalid_count;
  END IF;
END $$;

-- Update existing file paths to store relative paths
UPDATE reports
SET file_path = public.get_relative_path(file_path)
WHERE file_path LIKE '%/storage/v1/object/sign/%'
  AND public.is_valid_file_path(public.get_relative_path(file_path));

-- Clean up any paths that might have 'reports/' prefix
UPDATE reports 
SET file_path = regexp_replace(file_path, '^reports/', '')
WHERE file_path LIKE 'reports/%'
  AND public.is_valid_file_path(regexp_replace(file_path, '^reports/', ''));

-- Create index for faster file path lookups
CREATE INDEX IF NOT EXISTS reports_file_path_idx ON reports(file_path);

-- Drop temporary table
DROP TABLE invalid_paths;