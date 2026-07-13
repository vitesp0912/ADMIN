-- Add author display name to existing pump_notes table
-- Run once in Supabase SQL editor if the column is missing.

alter table public.pump_notes
  add column if not exists author_name text null;
