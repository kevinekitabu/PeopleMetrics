/*
  # Add GIN index for files array

  1. Changes
    - Add GIN index for faster searching in files array
    - Add index for file paths in array

  2. Performance
    - Improve query performance for file lookups
*/

-- Create GIN index for files array
CREATE INDEX IF NOT EXISTS reports_files_gin_idx
ON reports USING GIN (files);

-- Create index for file paths
CREATE INDEX IF NOT EXISTS reports_file_paths_idx
ON reports USING GIN ((files->>'path'));