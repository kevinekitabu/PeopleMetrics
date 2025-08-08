/*
  # Fix check constraint with subquery

  1. Problem
    - The existing `valid_file_path` constraint uses a subquery which is not allowed in CHECK constraints
    - This causes a 400 error when running SQL queries

  2. Solution
    - Drop the problematic constraint
    - Create a simpler regex-based constraint that validates file path format
    - Use a pattern that matches the expected file path structure

  3. Changes
    - Remove constraint with subquery
    - Add simpler file path validation
    - Ensure paths follow the expected format: user_id/filename or user_id/timestamp-filename
*/

-- Drop the problematic constraint that uses a subquery
ALTER TABLE reports DROP CONSTRAINT IF EXISTS valid_file_path;

-- Add a simpler constraint that validates file path format using regex
-- This allows paths like: user_id/filename.ext or user_id/timestamp-filename.ext
ALTER TABLE reports ADD CONSTRAINT valid_file_path_format 
CHECK (
  file_path IS NULL OR 
  file_path ~ '^[a-f0-9\-]{36}/([0-9]+-)?[a-zA-Z0-9\-_\.]+\.[a-zA-Z0-9]+$'
);

-- Also ensure the files array constraint is properly formatted
ALTER TABLE reports DROP CONSTRAINT IF EXISTS files_array_size_check;
ALTER TABLE reports ADD CONSTRAINT files_array_size_check 
CHECK (
  files IS NULL OR 
  (array_length(files, 1) IS NULL OR (array_length(files, 1) >= 0 AND array_length(files, 1) <= 5))
);