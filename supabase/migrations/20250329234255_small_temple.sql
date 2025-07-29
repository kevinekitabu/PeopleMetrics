/*
  # Create indexes for files array

  1. Changes
    - Create GIN index for the entire files array
    - Create GIN index for file paths within the array
    - Use proper JSONB operators and functions

  2. Performance
    - Optimize for file path lookups
    - Enable efficient array searches
*/

-- Create GIN index for the entire files array
CREATE INDEX IF NOT EXISTS reports_files_gin_idx
ON reports USING GIN ((to_jsonb(files)));

-- Create index for file paths within the array
CREATE INDEX IF NOT EXISTS reports_file_paths_idx
ON reports USING GIN ((
  SELECT array_agg(value->>'path')
  FROM jsonb_array_elements(to_jsonb(files))
));