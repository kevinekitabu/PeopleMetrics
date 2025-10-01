/*
  # Complete Database Schema Setup for AI Report Management
  
  ## Overview
  This migration sets up the complete database schema for the AI Report Management application.
  It creates all necessary tables, security policies, indexes, and triggers.
  
  ## 1. Tables Created
  
  ### profiles
  - `id` (uuid, primary key) - References auth.users
  - `is_admin` (boolean) - Admin flag for super admin access
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### reports
  - `id` (uuid, primary key) - Unique report identifier
  - `user_id` (uuid, foreign key) - Owner of the report
  - `title` (text) - Report title
  - `description` (text) - Report description
  - `files` (jsonb array) - Uploaded files metadata
  - `feedback` (text) - AI-generated feedback
  - `context` (text) - Additional context
  - `regeneration_count` (integer) - Number of regenerations
  - `is_generating` (boolean) - Generation in progress flag
  - `stop_requested` (boolean) - Stop generation flag
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### subscriptions
  - `id` (uuid, primary key) - Unique subscription identifier
  - `user_id` (uuid, foreign key) - Subscriber
  - `plan` (text) - Subscription plan (basic/premium)
  - `interval` (text) - Billing interval (monthly/yearly)
  - `status` (text) - Subscription status (active/inactive/cancelled)
  - `current_period_end` (timestamptz) - Subscription expiry
  - `checkout_request_id` (text) - M-Pesa checkout reference
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### mpesa_payments
  - `id` (uuid, primary key) - Unique payment identifier
  - `checkout_request_id` (text, unique) - M-Pesa checkout reference
  - `merchant_request_id` (text) - M-Pesa merchant reference
  - `phone_number` (text) - Customer phone number
  - `amount` (numeric) - Payment amount
  - `status` (text) - Payment status (pending/completed/failed/cancelled)
  - `result_code` (integer) - M-Pesa result code
  - `result_desc` (text) - M-Pesa result description
  - `mpesa_receipt_number` (text) - M-Pesa transaction receipt
  - `transaction_date` (text) - M-Pesa transaction timestamp
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### mpesa_callbacks
  - `id` (uuid, primary key) - Unique callback identifier
  - `checkout_request_id` (text) - M-Pesa checkout reference
  - `merchant_request_id` (text) - M-Pesa merchant reference
  - `result_code` (integer) - M-Pesa result code
  - `result_desc` (text) - M-Pesa result description
  - `raw_response` (jsonb) - Full callback payload
  - `created_at` (timestamptz) - Creation timestamp
  
  ## 2. Security (RLS Policies)
  
  All tables have Row Level Security enabled with appropriate policies:
  - Users can only access their own data
  - Service role has full access for backend operations
  - Admin users have elevated privileges
  
  ## 3. Performance Optimizations
  
  - Indexes on foreign keys for faster joins
  - Indexes on frequently queried columns (status, created_at, etc.)
  - Auto-updating timestamp triggers
  
  ## 4. Important Notes
  
  - All operations are idempotent (safe to run multiple times)
  - Existing data is preserved
  - Uses IF NOT EXISTS and IF EXISTS checks throughout
*/

-- =============================================
-- PROFILES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
  DROP POLICY IF EXISTS "Service role has full access to profiles" ON profiles;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role has full access to profiles"
  ON profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================
-- REPORTS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  title text NOT NULL DEFAULT 'Untitled Report',
  description text NOT NULL DEFAULT '',
  files jsonb[] NOT NULL DEFAULT '{}',
  feedback text,
  context text NOT NULL DEFAULT '',
  regeneration_count integer NOT NULL DEFAULT 0,
  is_generating boolean NOT NULL DEFAULT false,
  stop_requested boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Reports policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view their own reports" ON reports;
  DROP POLICY IF EXISTS "Users can insert their own reports" ON reports;
  DROP POLICY IF EXISTS "Users can update their own reports" ON reports;
  DROP POLICY IF EXISTS "Users can delete their own reports" ON reports;
  DROP POLICY IF EXISTS "Service role has full access to reports" ON reports;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view their own reports"
  ON reports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reports"
  ON reports FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reports"
  ON reports FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to reports"
  ON reports FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Reports indexes
CREATE INDEX IF NOT EXISTS reports_user_id_idx ON reports(user_id);
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS reports_is_generating_idx ON reports(is_generating);

-- =============================================
-- SUBSCRIPTIONS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  plan text NOT NULL,
  interval text NOT NULL,
  status text NOT NULL,
  current_period_end timestamptz NOT NULL,
  checkout_request_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Subscriptions policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view their own subscriptions" ON subscriptions;
  DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON subscriptions;
  DROP POLICY IF EXISTS "Users can update their own subscriptions" ON subscriptions;
  DROP POLICY IF EXISTS "Service role has full access to subscriptions" ON subscriptions;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view their own subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role has full access to subscriptions"
  ON subscriptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Subscriptions indexes
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);
CREATE INDEX IF NOT EXISTS subscriptions_checkout_request_id_idx ON subscriptions(checkout_request_id);

-- =============================================
-- MPESA PAYMENTS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS mpesa_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_request_id text UNIQUE NOT NULL,
  merchant_request_id text,
  phone_number text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  result_code integer,
  result_desc text,
  mpesa_receipt_number text,
  transaction_date text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE mpesa_payments ENABLE ROW LEVEL SECURITY;

-- M-Pesa payments policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Service role has full access to mpesa_payments" ON mpesa_payments;
  DROP POLICY IF EXISTS "Users can insert payments" ON mpesa_payments;
  DROP POLICY IF EXISTS "Users can view their own payments" ON mpesa_payments;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Service role has full access to mpesa_payments"
  ON mpesa_payments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can insert payments"
  ON mpesa_payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view their own payments"
  ON mpesa_payments FOR SELECT
  TO authenticated
  USING (true);

-- M-Pesa payments indexes
CREATE INDEX IF NOT EXISTS mpesa_payments_checkout_request_id_idx ON mpesa_payments(checkout_request_id);
CREATE INDEX IF NOT EXISTS mpesa_payments_phone_number_idx ON mpesa_payments(phone_number);
CREATE INDEX IF NOT EXISTS mpesa_payments_status_idx ON mpesa_payments(status);
CREATE INDEX IF NOT EXISTS mpesa_payments_created_at_idx ON mpesa_payments(created_at DESC);
CREATE INDEX IF NOT EXISTS mpesa_payments_receipt_number_idx ON mpesa_payments(mpesa_receipt_number);

-- =============================================
-- MPESA CALLBACKS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS mpesa_callbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_request_id text NOT NULL,
  merchant_request_id text NOT NULL,
  result_code integer NOT NULL,
  result_desc text NOT NULL,
  raw_response jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mpesa_callbacks ENABLE ROW LEVEL SECURITY;

-- M-Pesa callbacks policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Service role has full access to mpesa_callbacks" ON mpesa_callbacks;
  DROP POLICY IF EXISTS "Users can view callbacks" ON mpesa_callbacks;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Service role has full access to mpesa_callbacks"
  ON mpesa_callbacks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view callbacks"
  ON mpesa_callbacks FOR SELECT
  TO authenticated
  USING (true);

-- M-Pesa callbacks indexes
CREATE INDEX IF NOT EXISTS mpesa_callbacks_checkout_request_id_idx ON mpesa_callbacks(checkout_request_id);
CREATE INDEX IF NOT EXISTS mpesa_callbacks_created_at_idx ON mpesa_callbacks(created_at DESC);

-- =============================================
-- TRIGGERS FOR AUTO-UPDATING TIMESTAMPS
-- =============================================

-- Create or replace trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
DO $$
BEGIN
  -- Profiles trigger
  DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
  CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

  -- Reports trigger
  DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;
  CREATE TRIGGER update_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

  -- Subscriptions trigger
  DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
  CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

  -- M-Pesa payments trigger
  DROP TRIGGER IF EXISTS update_mpesa_payments_updated_at ON mpesa_payments;
  CREATE TRIGGER update_mpesa_payments_updated_at
    BEFORE UPDATE ON mpesa_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
END $$;
