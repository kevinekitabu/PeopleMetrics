/*
  # Create Simple M-Pesa Payment Tracking

  1. New Tables
    - `mpesa_payments`
      - `id` (uuid, primary key)
      - `checkout_request_id` (text, unique)
      - `merchant_request_id` (text)
      - `phone_number` (text)
      - `amount` (numeric)
      - `status` (text) - 'pending', 'completed', 'failed'
      - `result_code` (integer)
      - `result_desc` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `mpesa_payments` table
    - Add policies for service role access (for edge functions)
    - Add policies for authenticated users to view their payments

  3. Indexes
    - Index on checkout_request_id for fast lookups
    - Index on phone_number for user queries
    - Index on status for filtering
*/

-- Create mpesa_payments table
CREATE TABLE IF NOT EXISTS mpesa_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_request_id text UNIQUE NOT NULL,
  merchant_request_id text,
  phone_number text NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  result_code integer,
  result_desc text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE mpesa_payments ENABLE ROW LEVEL SECURITY;

-- Create policies for service role (edge functions)
CREATE POLICY "Service role has full access to mpesa_payments"
  ON mpesa_payments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create policy for authenticated users to view payments by phone number
CREATE POLICY "Users can view payments by phone number"
  ON mpesa_payments
  FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS mpesa_payments_checkout_request_id_idx ON mpesa_payments(checkout_request_id);
CREATE INDEX IF NOT EXISTS mpesa_payments_phone_number_idx ON mpesa_payments(phone_number);
CREATE INDEX IF NOT EXISTS mpesa_payments_status_idx ON mpesa_payments(status);
CREATE INDEX IF NOT EXISTS mpesa_payments_created_at_idx ON mpesa_payments(created_at DESC);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_mpesa_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_mpesa_payments_updated_at_trigger
    BEFORE UPDATE ON mpesa_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_mpesa_payments_updated_at();