/*
  # Fix Reports Table Schema

  1. Changes
    - Add is_generating column to track generation status
    - Add stop_requested column for cancellation
    - Update constraints and indexes
    - Clean up invalid data

  2. Security
    - Maintain existing RLS policies
    - Add constraints for data integrity
*/

-- Add new columns for generation control
ALTER TABLE reports
ADD COLUMN IF NOT EXISTS is_generating boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS stop_requested boolean DEFAULT false;

-- Create index for generation status
CREATE INDEX IF NOT EXISTS reports_is_generating_idx
ON reports(is_generating);

-- Update existing reports
UPDATE reports
SET is_generating = false,
    stop_requested = false
WHERE is_generating IS NULL OR stop_requested IS NULL;

-- Set NOT NULL constraints
ALTER TABLE reports
ALTER COLUMN is_generating SET NOT NULL,
ALTER COLUMN stop_requested SET NOT NULL;

-- Clean up any invalid states
UPDATE reports
SET is_generating = false,
    stop_requested = false
WHERE is_generating = true;

-- Add trigger to automatically reset stop_requested when generation starts
CREATE OR REPLACE FUNCTION reset_stop_requested()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_generating = true THEN
    NEW.stop_requested = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reset_stop_requested_trigger
  BEFORE UPDATE OF is_generating ON reports
  FOR EACH ROW
  EXECUTE FUNCTION reset_stop_requested();