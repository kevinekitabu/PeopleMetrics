/*
  # Update Storage Bucket Configuration

  1. Changes
    - Update storage bucket configuration to allow CSV files
    - Add storage policies for CSV file handling
    - Update allowed MIME types list

  2. Security
    - Maintain existing security policies
    - Add specific handling for CSV files
*/

-- Update storage bucket configuration
DO $$ 
BEGIN
  -- Update bucket configuration with new MIME types
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
  ]::text[]
  WHERE id = 'reports';

  -- Create policy for CSV files if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects'
    AND policyname = 'Allow CSV files for authenticated users'
  ) THEN
    CREATE POLICY "Allow CSV files for authenticated users"
    ON storage.objects
    FOR ALL
    TO authenticated
    USING (
      bucket_id = 'reports'
      AND auth.uid()::text = (storage.foldername(name))[1]
      AND lower(right(name, 4)) = '.csv'
    )
    WITH CHECK (
      bucket_id = 'reports'
      AND auth.uid()::text = (storage.foldername(name))[1]
      AND lower(right(name, 4)) = '.csv'
    );
  END IF;
END $$;