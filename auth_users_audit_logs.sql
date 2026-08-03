-- ============================================
-- Auth users audit log (auth.users INSERT/UPDATE/DELETE)
-- ============================================
-- Purpose:
--   Persist an audit trail for every change to auth.users.
--   Written only by SECURITY DEFINER triggers (not by clients).
--   Readable in the admin panel only by support@petrofi.com.
--
-- Apply in Supabase SQL Editor (needs permission to create
-- triggers on auth.users — typically project owner / service role).
-- ============================================

create table if not exists public.auth_users_audit_logs (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  email text null,
  phone text null,
  old_values jsonb null,
  new_values jsonb null,
  changed_fields text[] null,
  actor_id uuid null,
  actor_email text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_auth_users_audit_logs_created_at
  on public.auth_users_audit_logs (created_at desc);

create index if not exists idx_auth_users_audit_logs_auth_user_id
  on public.auth_users_audit_logs (auth_user_id);

create index if not exists idx_auth_users_audit_logs_action
  on public.auth_users_audit_logs (action);

create index if not exists idx_auth_users_audit_logs_email
  on public.auth_users_audit_logs (lower(email));

comment on table public.auth_users_audit_logs is
  'Audit trail for auth.users row changes. Written by triggers only.';

-- Strip secrets before storing JSON snapshots of auth.users
create or replace function public.auth_users_audit_sanitize(p_row auth.users)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if p_row is null then
    return null;
  end if;

  v := to_jsonb(p_row);

  -- Never persist password hashes / recovery tokens / sensitive secrets
  v := v - 'encrypted_password'
         - 'confirmation_token'
         - 'recovery_token'
         - 'email_change_token_new'
         - 'email_change_token_current'
         - 'phone_change_token'
         - 'reauthentication_token'
         - 'email_change'
         - 'phone_change';

  return v;
end;
$$;

create or replace function public.auth_users_audit_changed_fields(
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

create or replace function public.log_auth_users_audit()
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

  if tg_op = 'INSERT' then
    v_new := public.auth_users_audit_sanitize(new);
    insert into public.auth_users_audit_logs (
      auth_user_id, action, email, phone, old_values, new_values, changed_fields,
      actor_id, actor_email
    ) values (
      new.id, 'INSERT', new.email, new.phone, null, v_new, null,
      v_actor_id, v_actor_email
    );
    return new;
  elsif tg_op = 'UPDATE' then
    v_old := public.auth_users_audit_sanitize(old);
    v_new := public.auth_users_audit_sanitize(new);
    insert into public.auth_users_audit_logs (
      auth_user_id, action, email, phone, old_values, new_values, changed_fields,
      actor_id, actor_email
    ) values (
      new.id,
      'UPDATE',
      new.email,
      new.phone,
      v_old,
      v_new,
      public.auth_users_audit_changed_fields(v_old, v_new),
      v_actor_id,
      v_actor_email
    );
    return new;
  elsif tg_op = 'DELETE' then
    v_old := public.auth_users_audit_sanitize(old);
    insert into public.auth_users_audit_logs (
      auth_user_id, action, email, phone, old_values, new_values, changed_fields,
      actor_id, actor_email
    ) values (
      old.id, 'DELETE', old.email, old.phone, v_old, null, null,
      v_actor_id, v_actor_email
    );
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_auth_users_audit on auth.users;
create trigger trg_auth_users_audit
  after insert or update or delete on auth.users
  for each row
  execute function public.log_auth_users_audit();

-- ============================================
-- Privileges + RLS (support@petrofi.com only)
-- ============================================

alter table public.auth_users_audit_logs enable row level security;

revoke all on table public.auth_users_audit_logs from public;
revoke all on table public.auth_users_audit_logs from anon;
revoke all on table public.auth_users_audit_logs from authenticated;

grant select on table public.auth_users_audit_logs to authenticated;
grant all on table public.auth_users_audit_logs to service_role;

drop policy if exists "Support admin can select auth_users_audit_logs"
  on public.auth_users_audit_logs;

create policy "Support admin can select auth_users_audit_logs"
  on public.auth_users_audit_logs
  for select
  to authenticated
  using (
    lower(trim(coalesce(auth.jwt() ->> 'email', ''))) = 'support@petrofi.com'
  );
