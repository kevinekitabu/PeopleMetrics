/*
  # Harmonize Database Setup

  1. Changes
    - Drop and recreate reports table with proper constraints
    - Reset storage policies
    - Add new indexes for performance
    - Update RLS policies

  2. Security
    - Enable RLS
    - Add comprehensive policies for:
      - File access
      - Report management
      - Storage operations
*/

-- Recreate reports table
DROP TABLE IF EXISTS reports;

CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  file_path text NOT NULL,
  feedback text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_file_path CHECK (
    file_path ~ '^[a-f0-9\-]{36}/[0-9]+\-[a-zA-Z0-9\-_\.]+\.[a-zA-Z0-9]+$'
    OR file_path ~ '^[a-f0-9\-]{36}/[a-zA-Z0-9\-_\.]+\.[a-zA-Z0-9]+$'
  )
);

-- Enable RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX reports_user_id_idx ON reports(user_id);
CREATE INDEX reports_created_at_idx ON reports(created_at DESC);
CREATE INDEX reports_file_path_idx ON reports(file_path);

-- Create RLS policies
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

-- Storage bucket setup
DO $$ 
BEGIN
  -- Create reports bucket if it doesn't exist
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('reports', 'reports', false)
  ON CONFLICT (id) DO UPDATE
  SET public = false;

  -- Update bucket configuration
  UPDATE storage.buckets
  SET allowed_mime_types = ARRAY[
    'text/plain',
    'text/csv',
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]::text[],
  file_size_limit = 52428800
  WHERE id = 'reports';
END $$;

-- Storage policies
DO $$ 
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "Give users access to own folder" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to read own files" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to upload own files" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to update own files" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to delete own files" ON storage.objects;
  
  -- Create new policies
  CREATE POLICY "Allow authenticated users to read own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'reports' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

  CREATE POLICY "Allow authenticated users to upload own files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'reports' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

  CREATE POLICY "Allow authenticated users to update own files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'reports' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'reports' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

  CREATE POLICY "Allow authenticated users to delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'reports' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
END $$;