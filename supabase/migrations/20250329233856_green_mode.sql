/*
  # Add Report Metadata

  1. Changes
    - Add title and description columns to reports table
    - Add files column to store file metadata
    - Add updated_at column for tracking changes
    - Update existing reports with default values

  2. Security
    - Maintain existing RLS policies
*/

-- Add new columns
ALTER TABLE reports
ADD COLUMN IF NOT EXISTS title text DEFAULT 'Untitled Report',
ADD COLUMN IF NOT EXISTS description text DEFAULT '',
ADD COLUMN IF NOT EXISTS files jsonb[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_reports_updated_at
    BEFORE UPDATE
    ON reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update existing reports
UPDATE reports
SET title = 'Untitled Report',
    description = '',
    files = '{}',
    updated_at = created_at
WHERE title IS NULL;

-- Add NOT NULL constraints
ALTER TABLE reports
ALTER COLUMN title SET NOT NULL,
ALTER COLUMN description SET NOT NULL,
ALTER COLUMN files SET NOT NULL,
ALTER COLUMN updated_at SET NOT NULL;