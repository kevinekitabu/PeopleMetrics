/*
  # Fix Subscriptions RLS Policies

  1. Changes
    - Drop existing RLS policies for subscriptions table
    - Create new policies for:
      - Inserting new subscriptions
      - Updating existing subscriptions
      - Viewing subscriptions
    - Add service role policy for M-Pesa callback processing

  2. Security
    - Enable RLS
    - Ensure users can only access their own subscriptions
    - Allow service role full access for callback processing
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Service role has full access" ON subscriptions;

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