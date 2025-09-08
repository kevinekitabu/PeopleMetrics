/*
  # Comprehensive DataStreamHr Setup with M-Pesa Integration

  This migration sets up the complete database schema for DataStreamHr including:
  
  1. New Tables
    - `profiles` - User profiles with admin flags
    - `reports` - Document reports with AI analysis
    - `subscriptions` - User subscription management
    - `mpesa_payments` - M-Pesa payment tracking
    - `mpesa_callbacks` - M-Pesa callback storage

  2. Security
    - Enable RLS on all tables
    - Add comprehensive policies for data access
    - Set up storage bucket policies

  3. Triggers and Functions
    - Auto-create profiles for new users
    - Clean up storage files when reports are deleted
    - Update timestamps automatically

  4. M-Pesa Integration
    - Payment tracking tables
    - Callback handling
    - Status management
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled Report',
  description text NOT NULL DEFAULT '',
  files jsonb[] NOT NULL DEFAULT '{}',
  feedback text,
  context text NOT NULL DEFAULT '',
  regeneration_count integer NOT NULL DEFAULT 0,
  is_generating boolean NOT NULL DEFAULT false,
  stop_requested boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL,
  interval text NOT NULL,
  status text NOT NULL,
  current_period_end timestamptz NOT NULL,
  checkout_request_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create M-Pesa payments table
CREATE TABLE IF NOT EXISTS mpesa_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_request_id text NOT NULL,
  merchant_request_id text,
  phone_number text NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  result_code integer,
  result_desc text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create M-Pesa callbacks table
CREATE TABLE IF NOT EXISTS mpesa_callbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_request_id text NOT NULL,
  merchant_request_id text NOT NULL,
  result_code integer NOT NULL,
  result_desc text NOT NULL,
  raw_response jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpesa_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpesa_callbacks ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Reports policies
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

CREATE POLICY "Users can delete their own reports"
  ON reports FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Subscriptions policies
CREATE POLICY "Users can view their own subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role has full access to subscriptions"
  ON subscriptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- M-Pesa payments policies
CREATE POLICY "Service role has full access to mpesa_payments"
  ON mpesa_payments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can view all mpesa_payments"
  ON mpesa_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- M-Pesa callbacks policies
CREATE POLICY "Service role has full access to mpesa_callbacks"
  ON mpesa_callbacks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can view all mpesa_callbacks"
  ON mpesa_callbacks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Add constraints
ALTER TABLE reports
ADD CONSTRAINT IF NOT EXISTS files_array_size_check 
CHECK (
  CASE 
    WHEN files IS NULL THEN true
    ELSE array_length(files, 1) IS NULL OR (array_length(files, 1) >= 0 AND array_length(files, 1) <= 5)
  END
);

ALTER TABLE reports
ADD CONSTRAINT IF NOT EXISTS context_length_check 
CHECK (length(COALESCE(context, '')) <= 100);

ALTER TABLE reports
ADD CONSTRAINT IF NOT EXISTS regeneration_count_check 
CHECK (regeneration_count >= 0 AND regeneration_count <= 5);

ALTER TABLE mpesa_payments
ADD CONSTRAINT IF NOT EXISTS amount_positive_check
CHECK (amount > 0);

ALTER TABLE mpesa_payments
ADD CONSTRAINT IF NOT EXISTS valid_status_check
CHECK (status IN ('pending', 'completed', 'failed', 'cancelled'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS profiles_id_idx ON profiles(id);
CREATE INDEX IF NOT EXISTS profiles_is_admin_idx ON profiles(is_admin) WHERE is_admin = true;

CREATE INDEX IF NOT EXISTS reports_user_id_idx ON reports(user_id);
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS reports_user_id_created_at_idx ON reports(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_is_generating_idx ON reports(is_generating) WHERE is_generating = true;
CREATE INDEX IF NOT EXISTS reports_files_gin_idx ON reports USING GIN (files);

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);
CREATE INDEX IF NOT EXISTS subscriptions_checkout_request_id_idx ON subscriptions(checkout_request_id);
CREATE INDEX IF NOT EXISTS subscriptions_user_status_idx ON subscriptions(user_id, status);

CREATE INDEX IF NOT EXISTS mpesa_payments_checkout_request_id_idx ON mpesa_payments(checkout_request_id);
CREATE INDEX IF NOT EXISTS mpesa_payments_status_idx ON mpesa_payments(status);
CREATE INDEX IF NOT EXISTS mpesa_payments_phone_number_idx ON mpesa_payments(phone_number);
CREATE INDEX IF NOT EXISTS mpesa_payments_created_at_idx ON mpesa_payments(created_at DESC);

CREATE INDEX IF NOT EXISTS mpesa_callbacks_checkout_request_id_idx ON mpesa_callbacks(checkout_request_id);
CREATE INDEX IF NOT EXISTS mpesa_callbacks_created_at_idx ON mpesa_callbacks(created_at DESC);

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, is_admin)
  VALUES (
    NEW.id,
    CASE 
      WHEN NEW.email IN (
        'admin@gmail.com',
        'peoplemetricssolutions@gmail.com',
        'michelle.gacigi@gmail.com',
        'superadmin@mail.com'
      ) THEN true
      ELSE false
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to update updated_at
DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;
CREATE TRIGGER update_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_mpesa_payments_updated_at ON mpesa_payments;
CREATE TRIGGER update_mpesa_payments_updated_at
    BEFORE UPDATE ON mpesa_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to delete storage objects when report is deleted
CREATE OR REPLACE FUNCTION delete_storage_objects()
RETURNS TRIGGER AS $$
DECLARE
  file_obj jsonb;
BEGIN
  IF OLD.files IS NOT NULL THEN
    -- Loop through each file and delete from storage
    FOR file_obj IN SELECT * FROM jsonb_array_elements(array_to_json(OLD.files)::jsonb)
    LOOP
      -- Delete the file from storage
      PERFORM storage.delete_object('reports', file_obj->>'path');
    END LOOP;
  END IF;
  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  -- Log error but allow deletion to continue
  RAISE WARNING 'Error deleting storage objects: %', SQLERRM;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to delete storage objects when report is deleted
DROP TRIGGER IF EXISTS delete_report_files ON reports;
CREATE TRIGGER delete_report_files
  BEFORE DELETE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION delete_storage_objects();

-- Function to reset stop_requested when generation starts
CREATE OR REPLACE FUNCTION reset_stop_requested()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_generating = true THEN
    NEW.stop_requested = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to reset stop_requested
DROP TRIGGER IF EXISTS reset_stop_requested_trigger ON reports;
CREATE TRIGGER reset_stop_requested_trigger
  BEFORE UPDATE OF is_generating ON reports
  FOR EACH ROW
  EXECUTE FUNCTION reset_stop_requested();

-- Storage bucket setup
DO $$ 
BEGIN
  -- Create reports bucket if it doesn't exist
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'reports', 
    'reports', 
    false,
    52428800,
    ARRAY[
      'text/plain',
      'text/csv',
      'application/pdf',
      'image/png',
      'image/jpeg',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ]::text[]
  )
  ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY[
      'text/plain',
      'text/csv',
      'application/pdf',
      'image/png',
      'image/jpeg',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ]::text[];
END $$;

-- Storage policies
DO $$ 
BEGIN
  -- Drop existing storage policies
  DROP POLICY IF EXISTS "Allow authenticated users to read own files" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to upload own files" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to update own files" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to delete own files" ON storage.objects;
  
  -- Create new storage policies
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

-- Insert profiles for existing users
INSERT INTO public.profiles (id, is_admin)
SELECT 
  id,
  CASE 
    WHEN email IN (
      'admin@gmail.com',
      'peoplemetricssolutions@gmail.com',
      'michelle.gacigi@gmail.com',
      'superadmin@mail.com'
    ) THEN true
    ELSE false
  END
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO UPDATE SET
  is_admin = CASE 
    WHEN (SELECT email FROM auth.users WHERE id = profiles.id) IN (
      'admin@gmail.com',
      'peoplemetricssolutions@gmail.com',
      'michelle.gacigi@gmail.com',
      'superadmin@mail.com'
    ) THEN true
    ELSE profiles.is_admin
  END,
  updated_at = now();

-- Create admin user if it doesn't exist
DO $$
DECLARE
  admin_uid uuid;
BEGIN
  -- Check if admin user already exists
  SELECT id INTO admin_uid
  FROM auth.users
  WHERE email = 'admin@gmail.com';

  -- If admin user doesn't exist, create it
  IF admin_uid IS NULL THEN
    -- Insert into auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'admin@gmail.com',
      crypt('adminadmin', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Admin User"}',
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    )
    RETURNING id INTO admin_uid;

    -- Insert into auth.identities
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      admin_uid,
      format('{"sub":"%s","email":"%s"}', admin_uid::text, 'admin@gmail.com')::jsonb,
      'email',
      admin_uid::text,
      NOW(),
      NOW(),
      NOW()
    );

    -- Create profile for admin user
    INSERT INTO public.profiles (id, is_admin)
    VALUES (admin_uid, true)
    ON CONFLICT (id) DO UPDATE SET is_admin = true;
  END IF;
END $$;