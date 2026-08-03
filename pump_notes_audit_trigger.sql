-- ============================================
-- Pump notes audit log (dedicated table + trigger)
-- ============================================
-- Creates public.pump_notes_audit_logs and logs every
-- INSERT / UPDATE / DELETE on public.pump_notes.
-- Includes pump_name / pump_code looked up from public.pumps.
--
-- Apply this FULL script in Supabase SQL Editor.
-- Then verify:
--   select * from public.pump_notes_audit_logs order by created_at desc limit 20;
-- ============================================

create table if not exists public.pump_notes_audit_logs (
  id uuid primary key default gen_random_uuid(),
  note_id uuid null,
  pump_id uuid null,
  pump_name text null,
  pump_code text null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  note_body text null,
  note_type text null,
  author_name text null,
  old_values jsonb null,
  new_values jsonb null,
  changed_fields text[] null,
  actor_id uuid null,
  actor_email text null,
  created_at timestamptz not null default now()
);

-- Safe if table already existed without these columns
alter table public.pump_notes_audit_logs
  add column if not exists pump_name text null;

alter table public.pump_notes_audit_logs
  add column if not exists pump_code text null;

create index if not exists idx_pump_notes_audit_logs_created_at
  on public.pump_notes_audit_logs (created_at desc);

create index if not exists idx_pump_notes_audit_logs_pump_id
  on public.pump_notes_audit_logs (pump_id);

create index if not exists idx_pump_notes_audit_logs_note_id
  on public.pump_notes_audit_logs (note_id);

create index if not exists idx_pump_notes_audit_logs_action
  on public.pump_notes_audit_logs (action);

create index if not exists idx_pump_notes_audit_logs_pump_name
  on public.pump_notes_audit_logs (lower(pump_name));

comment on table public.pump_notes_audit_logs is
  'Audit trail for pump_notes row changes. Written by triggers only.';

create or replace function public.pump_notes_audit_changed_fields(
  p_old jsonb,
  p_new jsonb
)
returns text[]
language plpgsql
immutable
as $$
declare
  v_keys text[] := array[]::text[];
  v_key text;
begin
  if p_old is null or p_new is null then
    return null;
  end if;

  for v_key in
    select distinct key
    from (
      select jsonb_object_keys(p_old) as key
      union
      select jsonb_object_keys(p_new) as key
    ) k
  loop
    if (p_old -> v_key) is distinct from (p_new -> v_key) then
      v_keys := array_append(v_keys, v_key);
    end if;
  end loop;

  return v_keys;
end;
$$;

create or replace function public.log_pump_notes_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_actor_id uuid;
  v_actor_email text;
  v_pump_id uuid;
  v_pump_name text;
  v_pump_code text;
begin
  begin
    v_actor_id := auth.uid();
  exception when others then
    v_actor_id := null;
  end;

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

  v_pump_id := coalesce(new.pump_id, old.pump_id);

  select p.name, p.pump_code
    into v_pump_name, v_pump_code
  from public.pumps p
  where p.id = v_pump_id;

  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    insert into public.pump_notes_audit_logs (
      note_id, pump_id, pump_name, pump_code, action, note_body, note_type, author_name,
      old_values, new_values, changed_fields, actor_id, actor_email
    ) values (
      new.id, new.pump_id, v_pump_name, v_pump_code, 'INSERT', new.body, new.note_type, new.author_name,
      null, v_new, null, v_actor_id, v_actor_email
    );
    return new;

  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    insert into public.pump_notes_audit_logs (
      note_id, pump_id, pump_name, pump_code, action, note_body, note_type, author_name,
      old_values, new_values, changed_fields, actor_id, actor_email
    ) values (
      new.id,
      new.pump_id,
      v_pump_name,
      v_pump_code,
      'UPDATE',
      new.body,
      new.note_type,
      coalesce(new.author_name, old.author_name),
      v_old,
      v_new,
      public.pump_notes_audit_changed_fields(v_old, v_new),
      v_actor_id,
      v_actor_email
    );
    return new;

  elsif tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    insert into public.pump_notes_audit_logs (
      note_id, pump_id, pump_name, pump_code, action, note_body, note_type, author_name,
      old_values, new_values, changed_fields, actor_id, actor_email
    ) values (
      old.id, old.pump_id, v_pump_name, v_pump_code, 'DELETE', old.body, old.note_type, old.author_name,
      v_old, null, null, v_actor_id, v_actor_email
    );
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_audit_admin_pump_notes on public.pump_notes;
drop trigger if exists trg_audit_pump_notes on public.pump_notes;
drop trigger if exists trg_log_pump_notes_audit on public.pump_notes;

-- Remove older function that wrote notes into public.audit_logs (pump Activity Log)
drop function if exists public.fn_audit_pump_notes();

create trigger trg_log_pump_notes_audit
  after insert or update or delete on public.pump_notes
  for each row
  execute function public.log_pump_notes_audit();

-- Notes belong ONLY in pump_notes_audit_logs — never in pump Activity Log (audit_logs).
-- Safe if audit_logs does not exist or has no matching rows.
do $$
begin
  if to_regclass('public.audit_logs') is not null then
    delete from public.audit_logs where entity_type = 'pump_notes';
  end if;
end $$;

-- Backfill pump name/code on existing audit rows
update public.pump_notes_audit_logs a
set
  pump_name = coalesce(a.pump_name, p.name),
  pump_code = coalesce(a.pump_code, p.pump_code)
from public.pumps p
where a.pump_id = p.id
  and (a.pump_name is null or a.pump_code is null);

-- ============================================
-- Privileges + RLS
-- ============================================

alter table public.pump_notes_audit_logs enable row level security;

revoke all on table public.pump_notes_audit_logs from public;
revoke all on table public.pump_notes_audit_logs from anon;
revoke all on table public.pump_notes_audit_logs from authenticated;

grant select on table public.pump_notes_audit_logs to authenticated;
grant all on table public.pump_notes_audit_logs to service_role;

drop policy if exists "Authenticated users can select pump_notes_audit_logs"
  on public.pump_notes_audit_logs;

create policy "Authenticated users can select pump_notes_audit_logs"
  on public.pump_notes_audit_logs
  for select
  to authenticated
  using (true);

grant insert on table public.pump_notes_audit_logs to postgres;
grant insert on table public.pump_notes_audit_logs to service_role;
