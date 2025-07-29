/*
  # Create GIN indexes for files array

  1. Changes
    - Create GIN index for the files array
    - Create index for file paths using jsonb_path_ops

  2. Performance
    - Optimize array searches
    - Improve file path lookups
*/

-- Create GIN index for the files array
CREATE INDEX IF NOT EXISTS reports_files_gin_idx
ON reports USING GIN (files);

-- Create index for file paths using jsonb_path_ops
CREATE INDEX IF NOT EXISTS reports_file_paths_idx
ON reports USING GIN ((files::jsonb) jsonb_path_ops);