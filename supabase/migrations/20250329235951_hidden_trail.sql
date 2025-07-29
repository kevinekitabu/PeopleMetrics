/*
  # Fix GIN Index for Files Array

  1. Changes
    - Create GIN index for files array using proper casting
    - Add index for faster file path lookups
    - Handle array elements properly

  2. Security
    - Maintain existing RLS policies
*/

-- Create GIN index for files array
CREATE INDEX IF NOT EXISTS reports_files_gin_idx
ON reports USING GIN ((files));

-- Create index for file paths
CREATE INDEX IF NOT EXISTS reports_file_paths_idx
ON reports USING GIN ((array_to_json(files)::jsonb));