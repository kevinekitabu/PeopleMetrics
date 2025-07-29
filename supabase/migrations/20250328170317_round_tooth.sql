/*
  # Add Storage Policies

  1. Security
    - Enable storage access for authenticated users
    - Add policies for:
      - Users can create storage buckets
      - Users can read from storage buckets
      - Users can write to storage buckets within their own folder
*/

-- Enable storage access for authenticated users
CREATE POLICY "Enable bucket creation for authenticated users"
ON storage.buckets
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Enable object access for authenticated users
CREATE POLICY "Give users access to own folder 1"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'reports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Give users access to own folder 2"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'reports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Give users access to own folder 3"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'reports' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'reports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Give users access to own folder 4"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'reports' AND (storage.foldername(name))[1] = auth.uid()::text);