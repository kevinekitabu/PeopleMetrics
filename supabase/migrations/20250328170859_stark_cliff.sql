/*
  # Fix Storage Access Policies

  1. Changes
    - Enable storage access for service role
    - Add policies for bucket management
    - Add policies for object management in the reports bucket
    - Fix folder access permissions

  2. Security
    - Enable policies for authenticated users to:
      - Create and manage buckets
      - Access objects in their own folders
      - Upload and manage their own files
*/

-- Enable storage access for service role
CREATE POLICY "Enable full access for service role"
ON storage.buckets
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Enable storage access for authenticated users
CREATE POLICY "Enable read access for authenticated users"
ON storage.buckets
FOR SELECT
TO authenticated
USING (true);

-- Enable object access for authenticated users
CREATE POLICY "Allow authenticated users to read own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'reports' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Allow authenticated users to upload own files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'reports' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Allow authenticated users to update own files"
ON storage.objects
FOR UPDATE
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
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'reports' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create reports bucket if it doesn't exist
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name)
  VALUES ('reports', 'reports')
  ON CONFLICT (id) DO NOTHING;
END $$;