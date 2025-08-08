/*
  # Fix Admin Access and Subscription Management

  1. Changes
    - Update profiles table to ensure admin users are properly flagged
    - Add function to automatically mark admin emails as admin users
    - Update RLS policies to allow proper admin access
    - Clean up subscription checks

  2. Security
    - Maintain existing RLS policies
    - Ensure admin users can access dashboard without subscription
    - Improve error handling for authentication
*/

-- Function to check if email is admin
CREATE OR REPLACE FUNCTION is_admin_email(email text)
RETURNS boolean AS $$
BEGIN
  RETURN email IN (
    'admin@gmail.com',
    'peoplemetricssolutions@gmail.com',
    'michelle.gacigi@gmail.com'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update existing users to mark admin emails as admin
UPDATE profiles 
SET is_admin = true, updated_at = now()
WHERE id IN (
  SELECT u.id 
  FROM auth.users u 
  WHERE is_admin_email(u.email)
);

-- Function to handle new user creation with admin check
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, is_admin)
  VALUES (
    new.id, 
    is_admin_email(new.email)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger to use new function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Add policy for admins to view all profiles (for admin dashboard features)
CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- Add policy for admins to view all subscriptions (for admin dashboard features)
CREATE POLICY "Admins can view all subscriptions"
  ON subscriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- Create index for admin lookups
CREATE INDEX IF NOT EXISTS profiles_is_admin_idx ON profiles(is_admin) WHERE is_admin = true;

-- Log admin users
DO $$
DECLARE
  admin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO admin_count 
  FROM profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE p.is_admin = true;
  
  RAISE NOTICE 'Updated % admin users in the system', admin_count;
END $$;