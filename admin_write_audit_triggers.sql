-- ============================================
-- Admin-panel write audit triggers
-- ============================================
-- Logs INSERT / UPDATE / DELETE into public.audit_logs
-- ONLY when the acting JWT email is an admin (@petrofi.com).
-- Does NOT log SELECT / viewing.
--
-- IMPORTANT
-- --------
-- 1) Run in Supabase SQL editor.
-- 2) Triggers cannot see "button presses" — they see DB writes.
--    Filtering by admin email approximates "admin panel only".
-- 3) If your audit_logs column names differ, adjust the INSERT list.
-- 4) Attach only to tables the admin panel WRITES (not read-only tabs).
-- ============================================

-- Optional allowlist (recommended). Leave empty to use *@petrofi.com rule.
create table if not exists public.admin_audit_emails (
  email text primary key,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.admin_audit_emails (email)
values
  ('support@petrofi.com')
on conflict (email) do nothing;

-- Who is an admin actor for audit purposes?
create or replace function public.is_admin_audit_actor()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  begin
    v_email := lower(trim(coalesce(
      auth.jwt() ->> 'email',
      (nullif(current_setting('request.jwt.claims', true), ''))::jsonb ->> 'email',
      ''
    )));
  exception when others then
    v_email := '';
  end;

  if v_email = '' then
    return false;
  end if;

  if exists (
    select 1
    from public.admin_audit_emails a
    where a.is_active
      and lower(a.email) = v_email
  ) then
    return true;
  end if;

  -- Fallback: any @petrofi.com login (remove if you want allowlist-only)
  return v_email like '%@petrofi.com';
end;
$$;

-- Resolve actor display fields from JWT
create or replace function public.admin_audit_actor_fields(
  out p_actor_id uuid,
  out p_actor_role text,
  out p_actor_email text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  p_actor_id := auth.uid();

  begin
    p_actor_email := lower(trim(coalesce(
      auth.jwt() ->> 'email',
      (nullif(current_setting('request.jwt.claims', true), ''))::jsonb ->> 'email',
      ''
    )));
  exception when others then
    p_actor_email := null;
  end;

  p_actor_role := 'admin';
end;
$$;

-- Generic AFTER trigger: write one audit_logs row for admin writes
create or replace function public.fn_audit_admin_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_actor_role text;
  v_actor_email text;
  v_pump_id uuid;
  v_entity_id uuid;
  v_action text;
  v_old jsonb;
  v_new jsonb;
  v_reason text;
begin
  -- Admin panel only (by actor email / allowlist)
  if not public.is_admin_audit_actor() then
    return coalesce(new, old);
  end if;

  select a.p_actor_id, a.p_actor_role, a.p_actor_email
    into v_actor_id, v_actor_role, v_actor_email
  from public.admin_audit_actor_fields() a;

  v_action := tg_op; -- INSERT | UPDATE | DELETE

  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_new := null;
    v_entity_id := old.id;
  elsif tg_op = 'INSERT' then
    v_old := null;
    v_new := to_jsonb(new);
    v_entity_id := new.id;
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_entity_id := new.id;

    -- Skip no-op updates (optional noise reduction)
    if v_old is not distinct from v_new then
      return new;
    end if;
  end if;

  -- Resolve pump_id
  if tg_table_name = 'pumps' then
    v_pump_id := coalesce(new.id, old.id);
  else
    begin
      v_pump_id := coalesce(
        (to_jsonb(coalesce(new, old)) ->> 'pump_id')::uuid,
        null
      );
    exception when others then
      v_pump_id := null;
    end;
  end if;

  v_reason := format(
    'Admin write via %s.%s by %s',
    tg_table_schema,
    tg_table_name,
    coalesce(v_actor_email, 'unknown')
  );

  begin
    insert into public.audit_logs (
      pump_id,
      action,
      entity_type,
      entity_id,
      actor_id,
      actor_role,
      reason,
      source,
      old_data,
      new_data,
      old_values,
      new_values,
      created_at
    ) values (
      v_pump_id,
      v_action,
      tg_table_name,
      v_entity_id,
      v_actor_id,
      v_actor_role,
      v_reason,
      'admin',
      v_old,
      v_new,
      v_old,
      v_new,
      now()
    );
  exception
    when undefined_column then
      -- Fallback if entity_id / old_values columns differ in your DB
      insert into public.audit_logs (
        pump_id,
        action,
        entity_type,
        actor_id,
        actor_role,
        reason,
        source,
        old_data,
        new_data,
        created_at
      ) values (
        v_pump_id,
        v_action,
        tg_table_name,
        v_actor_id,
        v_actor_role,
        v_reason,
        'admin',
        v_old,
        v_new,
        now()
      );
    when not_null_violation then
      -- e.g. leads with null pump_id when column is required — skip quietly
      raise notice 'audit skip for %.%: %', tg_table_name, tg_op, sqlerrm;
    when others then
      -- Never block the original write because of audit failure
      raise notice 'audit insert failed for %.%: %', tg_table_name, tg_op, sqlerrm;
  end;

  return coalesce(new, old);
end;
$$;

-- ============================================
-- Attach triggers to admin WRITE tables only
-- (matches current admin panel mutations)
-- ============================================

-- pumps: approve/reject, management save, delete
drop trigger if exists trg_audit_admin_pumps on public.pumps;
create trigger trg_audit_admin_pumps
  after insert or update or delete on public.pumps
  for each row
  execute function public.fn_audit_admin_write();

-- users: activate users, clear forgot-password flags, etc.
drop trigger if exists trg_audit_admin_users on public.users;
create trigger trg_audit_admin_users
  after insert or update or delete on public.users
  for each row
  execute function public.fn_audit_admin_write();

-- pump_notes: add / edit / delete follow-ups
drop trigger if exists trg_audit_admin_pump_notes on public.pump_notes;
create trigger trg_audit_admin_pump_notes
  after insert or update or delete on public.pump_notes
  for each row
  execute function public.fn_audit_admin_write();

-- leads: create / update / delete
drop trigger if exists trg_audit_admin_leads on public.leads;
create trigger trg_audit_admin_leads
  after insert or update or delete on public.leads
  for each row
  execute function public.fn_audit_admin_write();

-- ============================================
-- How to add more tables later
-- ============================================
-- drop trigger if exists trg_audit_admin_<table> on public.<table>;
-- create trigger trg_audit_admin_<table>
--   after insert or update or delete on public.<table>
--   for each row
--   execute function public.fn_audit_admin_write();

-- ============================================
-- Verify audit_logs columns if INSERT fails
-- ============================================
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'audit_logs'
-- order by ordinal_position;
