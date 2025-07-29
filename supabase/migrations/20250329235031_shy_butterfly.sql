/*
  # Add Report Context and Regeneration Tracking

  1. Changes
    - Add context column for report contextualization
    - Add regeneration_count to track number of regenerations
    - Add constraints for both columns
    - Update existing reports with default values

  2. Security
    - Maintain existing RLS policies
*/

-- Add new columns
ALTER TABLE reports
ADD COLUMN IF NOT EXISTS context text DEFAULT '',
ADD COLUMN IF NOT EXISTS regeneration_count integer DEFAULT 0,
ADD COLUMN description TEXT,
ADD COLUMN title TEXT;

-- Add constraints
ALTER TABLE reports
ADD CONSTRAINT context_length_check CHECK (length(context) <= 100),
ADD CONSTRAINT regeneration_count_check CHECK (regeneration_count BETWEEN 0 AND 5);

-- Update existing reports
UPDATE reports
SET context = '',
    regeneration_count = 0
WHERE context IS NULL OR regeneration_count IS NULL;

-- Set NOT NULL constraints
ALTER TABLE reports
ALTER COLUMN context SET NOT NULL,
ALTER COLUMN regeneration_count SET NOT NULL;

-- Add index for regeneration count
CREATE INDEX IF NOT EXISTS reports_regeneration_count_idx
ON reports(regeneration_count);