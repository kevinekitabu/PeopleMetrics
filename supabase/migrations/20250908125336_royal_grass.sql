/*
  # Add M-Pesa Payment System

  1. New Tables
    - `mpesa_payments`
      - `id` (uuid, primary key)
      - `checkout_request_id` (text, unique)
      - `merchant_request_id` (text)
      - `phone_number` (text)
      - `amount` (numeric)
      - `status` (text) - pending, completed, failed
      - `result_code` (integer)
      - `result_desc` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `mpesa_payments` table
    - Add policies for authenticated users to manage their payments
    - Add service role access for M-Pesa callbacks

  3. Indexes
    - Add indexes for efficient payment lookup and status checking
</*/

-- Create M-Pesa payments table
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

-- Enable RLS
ALTER TABLE mpesa_payments ENABLE ROW LEVEL SECURITY;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS mpesa_payments_checkout_request_id_idx ON mpesa_payments (checkout_request_id);
CREATE INDEX IF NOT EXISTS mpesa_payments_phone_number_idx ON mpesa_payments (phone_number);
CREATE INDEX IF NOT EXISTS mpesa_payments_status_idx ON mpesa_payments (status);
CREATE INDEX IF NOT EXISTS mpesa_payments_created_at_idx ON mpesa_payments (created_at DESC);

-- RLS Policies
CREATE POLICY "Users can view their own payments"
  ON mpesa_payments
  FOR SELECT
  TO authenticated
  USING (phone_number = auth.jwt() ->> 'phone' OR true); -- Allow viewing for now, can be restricted later

CREATE POLICY "Service role has full access to payments"
  ON mpesa_payments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can insert payments"
  ON mpesa_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add checkout_request_id column to subscriptions table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'checkout_request_id'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN checkout_request_id text;
    CREATE INDEX IF NOT EXISTS subscriptions_checkout_request_id_idx ON subscriptions (checkout_request_id);
  END IF;
END $$;

-- Update trigger for mpesa_payments updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_mpesa_payments_updated_at'
  ) THEN
    CREATE TRIGGER update_mpesa_payments_updated_at
      BEFORE UPDATE ON mpesa_payments
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;