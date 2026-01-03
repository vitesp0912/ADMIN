-- ============================================
-- Admin Panel RLS Policies for Pumps Table
-- ============================================
-- Run this SQL in Supabase SQL Editor to allow admin panel updates
-- 
-- This allows authenticated users to UPDATE pumps table
-- ============================================

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "Admin users can update pumps" ON pumps;
DROP POLICY IF EXISTS "Authenticated users can update pumps" ON pumps;

-- Option 1: Allow all authenticated users to update pumps (for admin panel)
-- Use this if your admin panel users are authenticated via Supabase Auth
CREATE POLICY "Authenticated users can update pumps" ON pumps
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Option 2: Allow users with admin role to update pumps
-- Use this if you have a role-based system
-- First, you need to add a role column to auth.users or use user metadata
-- CREATE POLICY "Admin users can update pumps" ON pumps
--   FOR UPDATE
--   USING (
--     auth.role() = 'authenticated' 
--     AND (
--       EXISTS (
--         SELECT 1 FROM auth.users 
--         WHERE auth.users.id = auth.uid() 
--         AND (auth.users.raw_user_meta_data->>'role' = 'admin' OR auth.users.raw_user_meta_data->>'is_admin' = 'true')
--       )
--     )
--   )
--   WITH CHECK (
--     auth.role() = 'authenticated' 
--     AND (
--       EXISTS (
--         SELECT 1 FROM auth.users 
--         WHERE auth.users.id = auth.uid() 
--         AND (auth.users.raw_user_meta_data->>'role' = 'admin' OR auth.users.raw_user_meta_data->>'is_admin' = 'true')
--       )
--     )
--   );

-- ============================================
-- Alternative: Disable RLS for admin operations
-- ============================================
-- WARNING: Only use this if you're using service role key on backend
-- DO NOT disable RLS if using anon key in frontend!

-- ALTER TABLE pumps DISABLE ROW LEVEL SECURITY;

-- ============================================
-- Recommended: Use Service Role Key on Backend
-- ============================================
-- The best practice is to:
-- 1. Create a backend API endpoint (Node.js/Express, Python/FastAPI, etc.)
-- 2. Use service role key on the backend (NEVER expose in frontend)
-- 3. Have the admin panel call your backend API
-- 4. Backend validates admin permissions and updates database

-- ============================================
-- Admin Panel RLS Policies for Users Table
-- ============================================
-- Allow authenticated users to UPDATE users table (for admin panel)
-- ============================================

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "Admin users can update users" ON users;
DROP POLICY IF EXISTS "Authenticated users can update users" ON users;

-- Allow all authenticated users to update users (for admin panel)
CREATE POLICY "Authenticated users can update users" ON users
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- Admin Panel RLS Policies for Meter Readings Table
-- ============================================
-- Allow authenticated users to SELECT meter_readings table (for admin panel)
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can select meter_readings" ON meter_readings;

-- Allow all authenticated users to select meter_readings (for admin panel)
CREATE POLICY "Authenticated users can select meter_readings" ON meter_readings
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================
-- Admin Panel RLS Policies for Nozzle Reading Table
-- ============================================
-- Allow authenticated users to SELECT nozzle_reading table (for admin panel)
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can select nozzle_reading" ON nozzle_reading;

CREATE POLICY "Authenticated users can select nozzle_reading" ON nozzle_reading
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================
-- Admin Panel RLS Policies for Sales Table
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can select sales" ON sales;

CREATE POLICY "Authenticated users can select sales" ON sales
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================
-- Admin Panel RLS Policies for Expenses Table
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can select expenses" ON expenses;

CREATE POLICY "Authenticated users can select expenses" ON expenses
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================
-- Admin Panel RLS Policies for Dip Entries Table
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can select dip_entries" ON dip_entries;

CREATE POLICY "Authenticated users can select dip_entries" ON dip_entries
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================
-- Admin Panel RLS Policies for Salary Entries Table
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can select salary_entries" ON salary_entries;

CREATE POLICY "Authenticated users can select salary_entries" ON salary_entries
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================
-- Check current RLS policies
-- ============================================
-- Run this to see current policies:
-- SELECT * FROM pg_policies WHERE tablename = 'pumps';
-- SELECT * FROM pg_policies WHERE tablename = 'users';
-- SELECT * FROM pg_policies WHERE tablename = 'meter_readings';
-- SELECT * FROM pg_policies WHERE tablename = 'sales';
-- SELECT * FROM pg_policies WHERE tablename = 'expenses';
-- SELECT * FROM pg_policies WHERE tablename = 'dip_entries';
-- SELECT * FROM pg_policies WHERE tablename = 'salary_entries';

