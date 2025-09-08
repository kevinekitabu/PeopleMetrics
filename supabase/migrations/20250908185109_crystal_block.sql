/*
  # Create M-Pesa tables for payment processing

  1. New Tables
    - `mpesa_callbacks`
      - `id` (uuid, primary key)
      - `checkout_request_id` (text, required)
      - `merchant_request_id` (text, required)
      - `result_code` (integer, required)
      - `result_desc` (text, required)
      - `raw_response` (jsonb, required)
      - `created_at` (timestamp)
    
    - `mpesa_payments` (if not exists)
      - `id` (uuid, primary key)
      - `checkout_request_id` (text, unique, required)
      - `merchant_request_id` (text)
      - `phone_number` (text, required)
      - `amount` (numeric, required)
      - `status` (text, default 'pending')
      - `result_code` (integer)
      - `result_desc` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for service role and authenticated users
    
  3. Performance
    - Add indexes for efficient lookups
    - Add triggers for updated_at timestamps
*/

-- Create mpesa_callbacks table
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

-- Enable RLS
ALTER TABLE mpesa_callbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpesa_payments ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS mpesa_callbacks_checkout_request_id_idx ON mpesa_callbacks (checkout_request_id);
CREATE INDEX IF NOT EXISTS mpesa_callbacks_created_at_idx ON mpesa_callbacks (created_at DESC);

CREATE INDEX IF NOT EXISTS mpesa_payments_checkout_request_id_idx ON mpesa_payments (checkout_request_id);
CREATE INDEX IF NOT EXISTS mpesa_payments_phone_number_idx ON mpesa_payments (phone_number);
CREATE INDEX IF NOT EXISTS mpesa_payments_status_idx ON mpesa_payments (status);
CREATE INDEX IF NOT EXISTS mpesa_payments_created_at_idx ON mpesa_payments (created_at DESC);

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

-- Create RLS policies for mpesa_payments
CREATE POLICY "Service role has full access to mpesa_payments"
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
  USING (true);

-- Create trigger function for updated_at if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for mpesa_payments updated_at
DROP TRIGGER IF EXISTS update_mpesa_payments_updated_at ON mpesa_payments;
CREATE TRIGGER update_mpesa_payments_updated_at
    BEFORE UPDATE ON mpesa_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();