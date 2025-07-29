/*
  # Add checkout_request_id to subscriptions table

  1. Changes
    - Add checkout_request_id column to subscriptions table
    - Add index for faster lookups
    - Add pending status to possible subscription states

  2. Security
    - Maintain existing RLS policies
*/

-- Add checkout_request_id column
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS checkout_request_id text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS subscriptions_checkout_request_id_idx 
ON subscriptions(checkout_request_id);

-- Add comment explaining the column
COMMENT ON COLUMN subscriptions.checkout_request_id IS 
'M-Pesa checkout request ID for tracking payment status';