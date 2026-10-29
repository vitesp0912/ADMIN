-- ============================================
-- Remove pump lifecycle state only
-- ============================================
-- Drops public.pumps.pump_state and the helpers that exist only for it:
--   triggers trg_set_pump_state_on_insert, trg_log_pump_state_change
--   functions set_pump_state_on_insert, log_pump_state_change, pump_state_label
--   index idx_pumps_pump_state
--   constraint pumps_pump_state_check
--
-- Pump rows stay. Name, phone, owner, address, city, state (location),
-- registration, subscriptions, users, readings, sales, and notes stay.
-- Notes already written when a state changed are left in pump_notes.
--
-- Apply in the Supabase SQL editor. Do not add CASCADE.
-- ============================================

drop trigger if exists trg_log_pump_state_change on public.pumps;
drop trigger if exists trg_set_pump_state_on_insert on public.pumps;

drop function if exists public.log_pump_state_change();
drop function if exists public.set_pump_state_on_insert();
drop function if exists public.pump_state_label(text);

drop index if exists public.idx_pumps_pump_state;

alter table public.pumps
  drop constraint if exists pumps_pump_state_check;

alter table public.pumps
  drop column if exists pump_state;
