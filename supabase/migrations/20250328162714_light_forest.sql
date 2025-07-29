/*
  # Create Reports Table

  1. New Tables
    - `reports`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `file_path` (text)
      - `feedback` (text, nullable)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `reports` table
    - Add policies for:
      - Users can view their own reports
      - Users can insert their own reports
      - Users can update their own reports

  3. Indexes
    - Index on user_id for faster lookups
    - Index on created_at for sorted queries
*/

-- Create reports table if it doesn't exist
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_path text NOT NULL,
  feedback text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id)
);

-- Enable RLS if not already enabled
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'reports' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create policies if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'reports' 
    AND policyname = 'Users can view their own reports'
  ) THEN
    CREATE POLICY "Users can view their own reports"
      ON reports
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'reports' 
    AND policyname = 'Users can insert their own reports'
  ) THEN
    CREATE POLICY "Users can insert their own reports"
      ON reports
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'reports' 
    AND policyname = 'Users can update their own reports'
  ) THEN
    CREATE POLICY "Users can update their own reports"
      ON reports
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS reports_user_id_idx ON reports(user_id);
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON reports(created_at DESC);