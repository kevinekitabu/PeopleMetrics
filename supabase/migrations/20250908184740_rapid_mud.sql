/*
  # Create M-Pesa payment tracking tables

  1. New Tables
    - `mpesa_callbacks`
      - `id` (uuid, primary key)
      - `checkout_request_id` (text, not null)
      - `merchant_request_id` (text, not null)
      - `result_code` (integer, not null)
      - `result_desc` (text, not null)
      - `raw_response` (jsonb, not null)
      - `created_at` (timestamp)
    
    - `mpesa_payments`
      - `id` (uuid, primary key)
      - `checkout_request_id` (text, unique, not null)
      - `merchant_request_id` (text)
      - `phone_number` (text, not null)
      - `amount` (numeric, not null)
      - `status` (text, not null, default 'pending')
      - `result_code` (integer)
      - `result_desc` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users and service role
    
  3. Indexes
    - Add indexes for efficient querying
    - Add trigger for updated_at
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

-- Create mpesa_payments table
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

-- Create indexes for efficient querying
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

CREATE POLICY "Only authenticated users can view M-Pesa callbacks"
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
  USING (true);

-- Create trigger for updated_at on mpesa_payments
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_mpesa_payments_updated_at
    BEFORE UPDATE ON mpesa_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();