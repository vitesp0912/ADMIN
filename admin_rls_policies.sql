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
-- Check current RLS policies
-- ============================================
-- Run this to see current policies:
-- SELECT * FROM pg_policies WHERE tablename = 'pumps';
-- SELECT * FROM pg_policies WHERE tablename = 'users';

