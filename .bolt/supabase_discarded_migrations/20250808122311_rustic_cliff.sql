/*
  # Fix GIN index for files array

  1. Changes
    - Drop the incorrect GIN index on files->>'path'
    - Create a proper GIN index on the files jsonb array
    - The files column contains an array of objects like [{"path": "...", "name": "...", "type": "..."}]
    - Use GIN index on the entire array for efficient querying

  2. Index Usage
    - This will allow efficient queries on the files array
    - Can search within the array elements using @> operator
    - Example: WHERE files @> '[{"path": "some/path"}]'
*/

-- Drop the problematic index if it exists
DROP INDEX IF EXISTS reports_files_gin_idx;

-- Create a proper GIN index on the files jsonb array
-- This allows efficient searching within the array elements
CREATE INDEX IF NOT EXISTS reports_files_gin_idx ON reports USING GIN (files);

-- Optional: Create a more specific index for path searches if needed
-- This creates an index on all path values within the files array
CREATE INDEX IF NOT EXISTS reports_files_path_idx ON reports USING GIN ((
  SELECT array_agg(value->>'path') 
  FROM jsonb_array_elements(files::jsonb) AS value
));