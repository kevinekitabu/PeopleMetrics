/*
  # Fix Context Column and Add Generation Control

  1. Changes
    - Add context column with proper constraints
    - Add generation control columns
    - Update existing data
    - Add triggers and indexes

  2. Security
    - Maintain existing RLS policies
    - Add data validation
*/

-- First, ensure the columns exist
ALTER TABLE reports
ADD COLUMN IF NOT EXISTS context text DEFAULT '',
ADD COLUMN IF NOT EXISTS regeneration_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_generating boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS stop_requested boolean DEFAULT false;

-- Update any NULL values
UPDATE reports
SET context = COALESCE(context, ''),
    regeneration_count = COALESCE(regeneration_count, 0),
    is_generating = COALESCE(is_generating, false),
    stop_requested = COALESCE(stop_requested, false);

-- Add NOT NULL constraints
ALTER TABLE reports
ALTER COLUMN context SET NOT NULL,
ALTER COLUMN regeneration_count SET NOT NULL,
ALTER COLUMN is_generating SET NOT NULL,
ALTER COLUMN stop_requested SET NOT NULL;

-- Drop existing constraints if they exist
ALTER TABLE reports
DROP CONSTRAINT IF EXISTS context_length_check,
DROP CONSTRAINT IF EXISTS regeneration_count_check;

-- Add constraints
ALTER TABLE reports
ADD CONSTRAINT context_length_check CHECK (length(context) <= 100),
ADD CONSTRAINT regeneration_count_check CHECK (regeneration_count BETWEEN 0 AND 5);

-- Create or replace trigger function for resetting stop_requested
CREATE OR REPLACE FUNCTION reset_stop_requested()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_generating = true THEN
    NEW.stop_requested = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS reset_stop_requested_trigger ON reports;
CREATE TRIGGER reset_stop_requested_trigger
  BEFORE UPDATE OF is_generating ON reports
  FOR EACH ROW
  EXECUTE FUNCTION reset_stop_requested();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS reports_regeneration_count_idx ON reports(regeneration_count);
CREATE INDEX IF NOT EXISTS reports_is_generating_idx ON reports(is_generating);

-- Clean up any invalid states
UPDATE reports
SET is_generating = false,
    stop_requested = false
WHERE is_generating = true;