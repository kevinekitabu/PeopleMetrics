/*
  # Add M-Pesa Receipt Number to Payments

  1. Changes
    - Add `mpesa_receipt_number` column to `mpesa_payments` table to store the M-Pesa transaction reference
    - Add `transaction_date` column to store the actual transaction timestamp from M-Pesa

  2. Purpose
    - Store the M-Pesa receipt number for reference and reconciliation
    - Store transaction date from M-Pesa for accurate record keeping
*/

-- Add mpesa_receipt_number column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mpesa_payments' AND column_name = 'mpesa_receipt_number'
  ) THEN
    ALTER TABLE mpesa_payments ADD COLUMN mpesa_receipt_number text;
  END IF;
END $$;

-- Add transaction_date column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mpesa_payments' AND column_name = 'transaction_date'
  ) THEN
    ALTER TABLE mpesa_payments ADD COLUMN transaction_date text;
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS mpesa_payments_receipt_number_idx ON mpesa_payments (mpesa_receipt_number);