-- Migration: List all current admins and (optionally) update admin emails
-- 1. List all current admins
SELECT id, email FROM profiles WHERE is_admin = true;

-- 2. (Optional) Update admin emails or add new admins
-- Example: Make a user admin by email
-- UPDATE profiles SET is_admin = true WHERE email = 'admin@gmail.com';

-- 3. (Optional) Add is_admin column if it does not exist
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- 4. (Optional) Policy: Allow admins to access dashboard regardless of subscription
-- See previous messages for policy SQL if needed.

-- Drop the policy if it already exists
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

-- Now create or recreate the policy
CREATE POLICY "Users can view their own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
