/*
  # Update reports table and policies

  1. Tables
    - Ensure reports table exists with all required columns
    - Add necessary indexes for performance

  2. Security
    - Enable RLS
    - Add policies for authenticated users to:
      - View their own reports
      - Insert their own reports
      - Update their own reports

  3. Changes
    - Add IF NOT EXISTS checks for policies
*/

-- Create reports table if it doesn't exist
CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  file_path TEXT NOT NULL,
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DO $$ 
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view their own reports" ON reports;
    DROP POLICY IF EXISTS "Users can insert their own reports" ON reports;
    DROP POLICY IF EXISTS "Users can update their own reports" ON reports;
    
    -- Create new policies
    CREATE POLICY "Users can view their own reports" 
    ON reports FOR SELECT 
    TO authenticated 
    USING (auth.uid() = user_id);

    CREATE POLICY "Users can insert their own reports" 
    ON reports FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Users can update their own reports" 
    ON reports FOR UPDATE 
    TO authenticated 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS reports_user_id_idx ON reports(user_id);
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON reports(created_at DESC);