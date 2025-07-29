/*
  # Create Reports Management Schema

  1. New Tables
    - `reports`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `file_path` (text)
      - `feedback` (text)
      - `created_at` (timestamp with time zone)

  2. Security
    - Enable RLS on `reports` table
    - Add policies for:
      - Users can view their own reports
      - Users can insert their own reports
      - Users can update their own reports
*/

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  file_path TEXT NOT NULL,
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see only their reports
CREATE POLICY "Users can view their own reports" 
ON reports FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own reports
CREATE POLICY "Users can insert their own reports" 
ON reports FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own reports
CREATE POLICY "Users can update their own reports" 
ON reports FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS reports_user_id_idx ON reports(user_id);
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON reports(created_at DESC);