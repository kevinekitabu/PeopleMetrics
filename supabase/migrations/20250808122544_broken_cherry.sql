/*
  # Clean Fix for All Migration Errors

  This migration removes all problematic constraints and indexes that are causing
  syntax errors and recreates them with proper PostgreSQL syntax.

  1. Remove problematic constraints and indexes
  2. Add simple, working constraints
  3. Create proper indexes for performance
*/

-- Drop all problematic constraints and indexes that might cause syntax errors
DO $$ 
BEGIN
    -- Drop constraints that might have subqueries or syntax issues
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'valid_file_path' AND table_name = 'reports') THEN
        ALTER TABLE reports DROP CONSTRAINT valid_file_path;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'files_array_size_check' AND table_name = 'reports') THEN
        ALTER TABLE reports DROP CONSTRAINT files_array_size_check;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'context_length_check' AND table_name = 'reports') THEN
        ALTER TABLE reports DROP CONSTRAINT context_length_check;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'regeneration_count_check' AND table_name = 'reports') THEN
        ALTER TABLE reports DROP CONSTRAINT regeneration_count_check;
    END IF;
    
    -- Drop problematic indexes
    DROP INDEX IF EXISTS reports_files_gin_idx;
    DROP INDEX IF EXISTS reports_files_path_idx;
    DROP INDEX IF EXISTS idx_reports_files_paths;
END $$;

-- Add simple, working constraints
ALTER TABLE reports 
ADD CONSTRAINT files_array_size_simple_check 
CHECK (jsonb_array_length(COALESCE(files, '[]'::jsonb)) BETWEEN 0 AND 5);

ALTER TABLE reports 
ADD CONSTRAINT context_length_simple_check 
CHECK (length(COALESCE(context, '')) <= 100);

ALTER TABLE reports 
ADD CONSTRAINT regeneration_count_simple_check 
CHECK (regeneration_count >= 0 AND regeneration_count <= 5);

-- Create a simple GIN index on the files array
CREATE INDEX IF NOT EXISTS reports_files_simple_gin_idx ON reports USING GIN (files);

-- Create regular indexes for common queries
CREATE INDEX IF NOT EXISTS reports_user_id_created_idx ON reports (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_is_generating_idx ON reports (is_generating) WHERE is_generating = true;
CREATE INDEX IF NOT EXISTS reports_stop_requested_idx ON reports (stop_requested) WHERE stop_requested = true;