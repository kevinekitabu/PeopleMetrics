/*
  # Fix Subscription RLS Policies

  1. Changes
    - Drop existing policies to ensure clean state
    - Create comprehensive RLS policies for:
      - User access to own subscriptions
      - Service role access for M-Pesa processing
    - Add indexes for performance

  2. Security
    - Enable RLS
    - Ensure users can only access their own data
    - Grant service role full access for callbacks
*/

-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view their own subscriptions" ON subscriptions;
  DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON subscriptions;
  DROP POLICY IF EXISTS "Users can update their own subscriptions" ON subscriptions;
  DROP POLICY IF EXISTS "Service role has full access" ON subscriptions;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policy for viewing subscriptions
CREATE POLICY "Users can view their own subscriptions"
ON subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create policy for inserting subscriptions
CREATE POLICY "Users can insert their own subscriptions"
ON subscriptions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create policy for updating subscriptions
CREATE POLICY "Users can update their own subscriptions"
ON subscriptions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create policy for service role (needed for M-Pesa callback processing)
CREATE POLICY "Service role has full access"
ON subscriptions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);
CREATE INDEX IF NOT EXISTS subscriptions_checkout_request_id_idx ON subscriptions(checkout_request_id);