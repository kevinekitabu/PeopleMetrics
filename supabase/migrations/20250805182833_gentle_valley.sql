/*
  # Add Admin Policies for Super Admin View

  1. Changes
    - Add policies for admins to view all data
    - Add RLS policies for admin access to all tables
    - Ensure admins can manage users and subscriptions

  2. Security
    - Only users with is_admin = true can access admin data
    - Maintain existing user-level security for non-admins
*/

-- Add policy for admins to view all users (auth.users access via edge functions)
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

-- Add policy for admins to update any profile
CREATE POLICY "Admins can update any profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- Add policy for admins to view all subscriptions
CREATE POLICY "Admins can view all subscriptions"
  ON subscriptions
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- Add policy for admins to update any subscription
CREATE POLICY "Admins can update any subscription"
  ON subscriptions
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  )
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- Add policy for admins to view all M-Pesa callbacks
CREATE POLICY "Admins can view all mpesa callbacks"
  ON mpesa_callbacks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- Add policy for admins to view all reports
CREATE POLICY "Admins can view all reports"
  ON reports
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- Create indexes for better admin query performance
CREATE INDEX IF NOT EXISTS profiles_is_admin_idx ON profiles(is_admin) WHERE is_admin = true;
CREATE INDEX IF NOT EXISTS subscriptions_status_created_idx ON subscriptions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS mpesa_callbacks_created_idx ON mpesa_callbacks(created_at DESC);
CREATE INDEX IF NOT EXISTS reports_created_user_idx ON reports(created_at DESC, user_id);

-- Log admin setup
DO $$
DECLARE
  admin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO admin_count 
  FROM profiles 
  WHERE is_admin = true;
  
  RAISE NOTICE 'Super admin policies created. Current admin count: %', admin_count;
END $$;