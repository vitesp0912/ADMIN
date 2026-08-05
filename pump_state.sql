-- ============================================
-- Pump lifecycle state (public.pumps.pump_state)
-- ============================================
-- States:
--   discovery_pending  — Discovery pending (default for new pumps)
--   setup_pending      — Setup pending
--   demo_pending       — Demo pending
--   activated          — Activated
--   followup_pending   — Followup pending
--
-- Existing pumps: pump_state stays NULL until set manually.
-- New pumps: BEFORE INSERT trigger sets discovery_pending when NULL.
-- State changes: AFTER UPDATE trigger adds a pump_notes row.
--
-- Apply in Supabase SQL Editor.
-- Requires: public.pumps, public.pump_notes
-- ============================================

alter table public.pumps
  add column if not exists pump_state text null;

comment on column public.pumps.pump_state is
  'Admin lifecycle state: discovery/setup/demo/activated/followup. NULL = legacy / unset.';

alter table public.pumps
  drop constraint if exists pumps_pump_state_check;

alter table public.pumps
  add constraint pumps_pump_state_check
  check (
    pump_state is null
    or pump_state in (
      'discovery_pending',
      'setup_pending',
      'demo_pending',
      'activated',
      'followup_pending'
    )
  );

create index if not exists idx_pumps_pump_state
  on public.pumps (pump_state);

-- Human-readable label for notes / reports
create or replace function public.pump_state_label(p_state text)
returns text
language sql
immutable
as $$
  select case p_state
    when 'discovery_pending' then 'Discovery pending'
    when 'setup_pending' then 'Setup pending'
    when 'demo_pending' then 'Demo pending'
    when 'activated' then 'Activated'
    when 'followup_pending' then 'Followup pending'
    else coalesce(p_state, 'Not set')
  end;
$$;

-- New pumps: default to Discovery pending when not supplied
create or replace function public.set_pump_state_on_insert()
returns trigger
language plpgsql
as $$
begin
  if new.pump_state is null then
    new.pump_state := 'discovery_pending';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_pump_state_on_insert on public.pumps;

create trigger trg_set_pump_state_on_insert
  before insert on public.pumps
  for each row
  execute function public.set_pump_state_on_insert();

-- Auto note when pump_state changes (e.g. discovery → setup)
create or replace function public.log_pump_state_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_email text;
  v_author text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.pump_state is not distinct from new.pump_state then
    return new;
  end if;

  begin
    v_actor_email := lower(trim(coalesce(
      auth.jwt() ->> 'email',
      (nullif(current_setting('request.jwt.claims', true), ''))::jsonb ->> 'email',
      ''
    )));
    if v_actor_email = '' then
      v_actor_email := null;
    end if;
  exception when others then
    v_actor_email := null;
  end;

  v_author := coalesce(v_actor_email, 'System');

  insert into public.pump_notes (
    pump_id,
    body,
    note_type,
    follow_up_at,
    author_name
  ) values (
    new.id,
    format(
      'Pump state changed from %s to %s.',
      public.pump_state_label(old.pump_state),
      public.pump_state_label(new.pump_state)
    ),
    'general',
    now(),
    v_author
  );

  return new;
end;
$$;

drop trigger if exists trg_log_pump_state_change on public.pumps;

create trigger trg_log_pump_state_change
  after update of pump_state on public.pumps
  for each row
  execute function public.log_pump_state_change();
