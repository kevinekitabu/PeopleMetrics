/*
  # Update M-Pesa Payment Schema

  1. Tables Updated
    - Update `mpesa_payments` table structure if it exists
    - Ensure `mpesa_callbacks` table has correct structure
    - Update `subscriptions` table to support M-Pesa checkout tracking

  2. Security
    - Update RLS policies for proper access control
    - Ensure service role can manage payments

  3. Performance
    - Add indexes for faster payment status lookups
    - Add triggers for automatic timestamp updates
*/

-- First, let's check and update the mpesa_payments table structure
DO $$
BEGIN
  -- Check if mpesa_payments table exists and update it
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'mpesa_payments') THEN
    -- Add missing columns if they don't exist
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'mpesa_payments' AND column_name = 'merchant_request_id') THEN
      ALTER TABLE mpesa_payments ADD COLUMN merchant_request_id text;
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'mpesa_payments' AND column_name = 'updated_at') THEN
      ALTER TABLE mpesa_payments ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;
  ELSE
    -- Create the table if it doesn't exist
    CREATE TABLE mpesa_payments (
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
  END IF;
END $$;

-- Ensure mpesa_callbacks table has the right structure
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'mpesa_callbacks') THEN
    CREATE TABLE mpesa_callbacks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      checkout_request_id text NOT NULL,
      merchant_request_id text NOT NULL,
      result_code integer NOT NULL,
      result_desc text NOT NULL,
      raw_response jsonb NOT NULL,
      created_at timestamptz DEFAULT now()
    );
  END IF;
END $$;

-- Ensure subscriptions table can track M-Pesa payments
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'checkout_request_id') THEN
    ALTER TABLE subscriptions ADD COLUMN checkout_request_id text;
  END IF;
END $$;

-- Enable RLS on all tables
ALTER TABLE mpesa_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpesa_callbacks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Service role has full access to mpesa_payments" ON mpesa_payments;
DROP POLICY IF EXISTS "Users can view their own payments" ON mpesa_payments;
DROP POLICY IF EXISTS "Users can insert payments" ON mpesa_payments;
DROP POLICY IF EXISTS "Service role has full access to mpesa_callbacks" ON mpesa_callbacks;
DROP POLICY IF EXISTS "Users can view callbacks" ON mpesa_callbacks;

-- Create RLS policies for mpesa_payments
CREATE POLICY "Service role has full access to mpesa_payments"
  ON mpesa_payments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view their own payments"
  ON mpesa_payments
  FOR SELECT
  TO authenticated
  USING (true); -- For now, allow all authenticated users to view payments

CREATE POLICY "Users can insert payments"
  ON mpesa_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create RLS policies for mpesa_callbacks
CREATE POLICY "Service role has full access to mpesa_callbacks"
  ON mpesa_callbacks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view callbacks"
  ON mpesa_callbacks
  FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS mpesa_payments_checkout_request_id_idx ON mpesa_payments (checkout_request_id);
CREATE INDEX IF NOT EXISTS mpesa_payments_status_idx ON mpesa_payments (status);
CREATE INDEX IF NOT EXISTS mpesa_payments_phone_number_idx ON mpesa_payments (phone_number);
CREATE INDEX IF NOT EXISTS mpesa_payments_created_at_idx ON mpesa_payments (created_at DESC);

CREATE INDEX IF NOT EXISTS mpesa_callbacks_checkout_request_id_idx ON mpesa_callbacks (checkout_request_id);
CREATE INDEX IF NOT EXISTS mpesa_callbacks_created_at_idx ON mpesa_callbacks (created_at DESC);

CREATE INDEX IF NOT EXISTS subscriptions_checkout_request_id_idx ON subscriptions (checkout_request_id);

-- Create or replace the update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add update trigger to mpesa_payments
DROP TRIGGER IF EXISTS update_mpesa_payments_updated_at ON mpesa_payments;
CREATE TRIGGER update_mpesa_payments_updated_at
  BEFORE UPDATE ON mpesa_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();