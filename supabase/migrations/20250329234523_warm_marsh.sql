/*
  # Add files array column and constraints

  1. Changes
    - Add files array column
    - Add check constraints for files array
    - Create index for files array

  2. Security
    - Maintain existing RLS policies
    - Ensure data integrity with constraints
*/

-- Add files array column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'reports' 
    AND column_name = 'files'
  ) THEN
    ALTER TABLE reports 
    ADD COLUMN files jsonb[] DEFAULT '{}';
  END IF;
END $$;

-- Add check constraint for array size
ALTER TABLE reports
ADD CONSTRAINT files_array_size_check
CHECK (
  CASE 
    WHEN files IS NULL THEN true
    ELSE array_length(files, 1) BETWEEN 0 AND 5
  END
);

-- Create GIN index for files array
CREATE INDEX IF NOT EXISTS reports_files_gin_idx
ON reports USING GIN (files);