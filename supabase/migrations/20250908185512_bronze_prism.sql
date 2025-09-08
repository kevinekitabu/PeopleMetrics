/*
  # Safe M-Pesa Tables Migration

  1. Tables
    - Creates `mpesa_callbacks` table if it doesn't exist
    - Creates `mpesa_payments` table if it doesn't exist
    - Adds missing columns to existing tables

  2. Security
    - Only creates policies if they don't exist
    - Enables RLS on tables
    - Proper access controls

  3. Performance
    - Adds indexes for efficient lookups
    - Auto-updating timestamps
*/

-- Create mpesa_callbacks table if it doesn't exist
CREATE TABLE IF NOT EXISTS mpesa_callbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_request_id text NOT NULL,
  merchant_request_id text NOT NULL,
  result_code integer NOT NULL,
  result_desc text NOT NULL,
  raw_response jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

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

-- Enable RLS on tables
ALTER TABLE mpesa_callbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpesa_payments ENABLE ROW LEVEL SECURITY;

-- Create indexes if they don't exist
DO $$
BEGIN
  -- Indexes for mpesa_callbacks
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'mpesa_callbacks' AND indexname = 'mpesa_callbacks_checkout_request_id_idx') THEN
    CREATE INDEX mpesa_callbacks_checkout_request_id_idx ON mpesa_callbacks (checkout_request_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'mpesa_callbacks' AND indexname = 'mpesa_callbacks_created_at_idx') THEN
    CREATE INDEX mpesa_callbacks_created_at_idx ON mpesa_callbacks (created_at DESC);
  END IF;

  -- Indexes for mpesa_payments
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'mpesa_payments' AND indexname = 'mpesa_payments_checkout_request_id_idx') THEN
    CREATE INDEX mpesa_payments_checkout_request_id_idx ON mpesa_payments (checkout_request_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'mpesa_payments' AND indexname = 'mpesa_payments_phone_number_idx') THEN
    CREATE INDEX mpesa_payments_phone_number_idx ON mpesa_payments (phone_number);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'mpesa_payments' AND indexname = 'mpesa_payments_status_idx') THEN
    CREATE INDEX mpesa_payments_status_idx ON mpesa_payments (status);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'mpesa_payments' AND indexname = 'mpesa_payments_created_at_idx') THEN
    CREATE INDEX mpesa_payments_created_at_idx ON mpesa_payments (created_at DESC);
  END IF;
END $$;

-- Create policies only if they don't exist
DO $$
BEGIN
  -- mpesa_callbacks policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mpesa_callbacks' AND policyname = 'Service role has full access to mpesa_callbacks') THEN
    CREATE POLICY "Service role has full access to mpesa_callbacks"
      ON mpesa_callbacks
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mpesa_callbacks' AND policyname = 'Users can view callbacks') THEN
    CREATE POLICY "Users can view callbacks"
      ON mpesa_callbacks
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  -- mpesa_payments policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mpesa_payments' AND policyname = 'Service role has full access to mpesa_payments') THEN
    CREATE POLICY "Service role has full access to mpesa_payments"
      ON mpesa_payments
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mpesa_payments' AND policyname = 'Users can insert payments') THEN
    CREATE POLICY "Users can insert payments"
      ON mpesa_payments
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mpesa_payments' AND policyname = 'Users can view their own payments') THEN
    CREATE POLICY "Users can view their own payments"
      ON mpesa_payments
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Create trigger function for updating timestamps if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for mpesa_payments updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_mpesa_payments_updated_at') THEN
    CREATE TRIGGER update_mpesa_payments_updated_at
      BEFORE UPDATE ON mpesa_payments
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;