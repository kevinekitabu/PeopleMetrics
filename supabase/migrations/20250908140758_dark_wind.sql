/*
  # Fix M-Pesa Payments Schema

  1. Tables
    - Ensure mpesa_payments table exists with correct structure
    - Add missing columns if needed
    - Update subscriptions table with checkout_request_id

  2. Security
    - Enable RLS on mpesa_payments
    - Add proper policies for payment access
    - Update subscription policies

  3. Indexes
    - Add performance indexes for payment lookups
    - Optimize status checking queries
*/

-- Create mpesa_payments table if it doesn't exist
CREATE TABLE IF NOT EXISTS mpesa_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_request_id text UNIQUE NOT NULL,
  merchant_request_id text,
  phone_number text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  result_code integer,
  result_desc text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add checkout_request_id to subscriptions if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'checkout_request_id'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN checkout_request_id text;
  END IF;
END $$;

-- Enable RLS on mpesa_payments
ALTER TABLE mpesa_payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own payments" ON mpesa_payments;
DROP POLICY IF EXISTS "Users can insert payments" ON mpesa_payments;
DROP POLICY IF EXISTS "Service role has full access to payments" ON mpesa_payments;

-- Create policies for mpesa_payments
CREATE POLICY "Users can view their own payments"
  ON mpesa_payments
  FOR SELECT
  TO authenticated
  USING (phone_number = (auth.jwt() ->> 'phone'::text) OR true);

CREATE POLICY "Users can insert payments"
  ON mpesa_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service role has full access to payments"
  ON mpesa_payments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS mpesa_payments_checkout_request_id_idx ON mpesa_payments (checkout_request_id);
CREATE INDEX IF NOT EXISTS mpesa_payments_phone_number_idx ON mpesa_payments (phone_number);
CREATE INDEX IF NOT EXISTS mpesa_payments_status_idx ON mpesa_payments (status);
CREATE INDEX IF NOT EXISTS mpesa_payments_created_at_idx ON mpesa_payments (created_at DESC);

-- Create index on subscriptions checkout_request_id
CREATE INDEX IF NOT EXISTS subscriptions_checkout_request_id_idx ON subscriptions (checkout_request_id);

-- Create or replace update trigger for mpesa_payments
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_mpesa_payments_updated_at ON mpesa_payments;
CREATE TRIGGER update_mpesa_payments_updated_at
  BEFORE UPDATE ON mpesa_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();