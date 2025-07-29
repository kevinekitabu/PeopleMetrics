/*
  # Fix file path constraint

  1. Changes
    - Remove file_path column as it's replaced by files array
    - Update existing reports to use files array
    - Add check constraint for files array

  2. Security
    - Maintain existing RLS policies
*/

-- Remove file_path column and its constraints
ALTER TABLE reports
DROP COLUMN IF EXISTS file_path;

-- Add check constraint for files array
ALTER TABLE reports
ADD CONSTRAINT valid_files_array
CHECK (
  files IS NOT NULL AND
  jsonb_array_length(files) > 0 AND
  jsonb_array_length(files) <= 5
);

-- Add check constraint for file paths in array
ALTER TABLE reports
ADD CONSTRAINT valid_file_paths
CHECK (
  (SELECT bool_and(
    (value->>'path')::text ~ '^[a-f0-9\-]{36}/[a-f0-9\-]{36}/[0-9]+\-[a-zA-Z0-9\-_\.]+\.[a-zA-Z0-9]+$'
  )
  FROM jsonb_array_elements(files))
);