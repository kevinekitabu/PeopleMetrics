/*
  # Fix duplicate policies and add missing tables

  1. Changes
    - Add checks for existing policies before creation
    - Ensure idempotent table creation
    - Add proper indexes and constraints

  2. Security
    - Enable RLS on all tables
    - Add policies for data access control
*/

-- Create subscriptions table if it doesn't exist
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  plan text NOT NULL,
  interval text NOT NULL,
  status text NOT NULL,
  current_period_end timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create M-Pesa callbacks table if it doesn't exist
CREATE TABLE IF NOT EXISTS mpesa_callbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_request_id text NOT NULL,
  merchant_request_id text NOT NULL,
  result_code integer NOT NULL,
  result_desc text NOT NULL,
  raw_response jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpesa_callbacks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DO $$ 
BEGIN
  -- Drop existing policies for subscriptions
  DROP POLICY IF EXISTS "Users can view their own subscriptions" ON subscriptions;
  DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON subscriptions;
  
  -- Drop existing policy for mpesa_callbacks
  DROP POLICY IF EXISTS "Only authenticated users can view M-Pesa callbacks" ON mpesa_callbacks;
END $$;

-- Recreate policies for subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Recreate policy for mpesa_callbacks
CREATE POLICY "Only authenticated users can view M-Pesa callbacks"
  ON mpesa_callbacks
  FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);
CREATE INDEX IF NOT EXISTS mpesa_callbacks_checkout_request_id_idx ON mpesa_callbacks(checkout_request_id);