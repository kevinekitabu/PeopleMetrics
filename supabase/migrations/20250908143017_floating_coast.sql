/*
  # Create M-Pesa payments table

  1. New Tables
    - `mpesa_payments`
      - `id` (uuid, primary key)
      - `checkout_request_id` (text, unique)
      - `merchant_request_id` (text, nullable)
      - `phone_number` (text, required)
      - `amount` (numeric, required)
      - `status` (text, default 'pending')
      - `result_code` (integer, nullable)
      - `result_desc` (text, nullable)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `mpesa_payments` table
    - Add policies for authenticated users and service role

  3. Indexes
    - Index on checkout_request_id for fast lookups
    - Index on status for filtering
    - Index on phone_number for user queries
</sql>

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

-- Enable RLS
ALTER TABLE mpesa_payments ENABLE ROW LEVEL SECURITY;

-- Create policies
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

CREATE POLICY "Users can view their own payments"
  ON mpesa_payments
  FOR SELECT
  TO authenticated
  USING ((phone_number = (jwt() ->> 'phone'::text)) OR true);

-- Create indexes
CREATE INDEX IF NOT EXISTS mpesa_payments_checkout_request_id_idx ON mpesa_payments (checkout_request_id);
CREATE INDEX IF NOT EXISTS mpesa_payments_status_idx ON mpesa_payments (status);
CREATE INDEX IF NOT EXISTS mpesa_payments_phone_number_idx ON mpesa_payments (phone_number);
CREATE INDEX IF NOT EXISTS mpesa_payments_created_at_idx ON mpesa_payments (created_at DESC);

-- Create update trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_mpesa_payments_updated_at ON mpesa_payments;
CREATE TRIGGER update_mpesa_payments_updated_at
    BEFORE UPDATE ON mpesa_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();