-- ============================================
-- Admin tasks (calls, demos, follow-ups)
-- ============================================
-- One row is one action for a registered pump.
-- Assignees are the names Anurag and Abhinandan. They share one admin login.
-- A new pump registration creates one unassigned discovery call, due the same IST day at 11:59pm.
-- created_by still stores that shared auth user.
-- Completing a task does not change the pump.
-- Optional notes are written to the existing pump_notes table.
--
-- Apply in the Supabase SQL Editor.
-- Requires: public.pumps, public.pump_notes
-- Safe to re-run.
-- ============================================

create table if not exists public.admin_audit_emails (
  email text primary key,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.admin_audit_emails (email)
values ('support@petrofi.com')
on conflict (email) do nothing;

-- Same admin check the audit triggers use: allowlist, otherwise *@petrofi.com.
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

  return v_email like '%@petrofi.com';
end;
$$;

create or replace function public.is_petrofi_admin_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = p_user_id
      and (
        exists (
          select 1
          from public.admin_audit_emails a
          where a.is_active
            and lower(a.email) = lower(coalesce(u.email, ''))
        )
        or lower(coalesce(u.email, '')) like '%@petrofi.com'
      )
  );
$$;

revoke all on function public.is_petrofi_admin_user(uuid) from public;
grant execute on function public.is_petrofi_admin_user(uuid) to authenticated, service_role;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  pump_id uuid not null references public.pumps (id) on delete cascade,
  title text not null,
  task_type text not null,
  assigned_to text null,
  due_at timestamptz not null,
  status text not null default 'pending',
  outcome text null,
  completed_at timestamptz null,
  note_id uuid null references public.pump_notes (id) on delete set null,
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_title_not_empty check (length(trim(title)) > 0),
  constraint tasks_type_check check (task_type in ('call', 'demo', 'follow_up')),
  constraint tasks_assigned_to_check check (
    assigned_to is null or assigned_to in ('Anurag', 'Abhinandan')
  ),
  constraint tasks_status_check check (status in ('pending', 'completed', 'cancelled')),
  constraint tasks_completed_fields_check check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

-- Policies and the old trigger reference assigned_to, so they must go before a type change.
drop policy if exists tasks_admin_select on public.tasks;
drop policy if exists tasks_admin_insert on public.tasks;
drop policy if exists tasks_admin_update on public.tasks;
drop policy if exists tasks_admin_delete on public.tasks;
drop trigger if exists trg_enforce_task_rules on public.tasks;

-- If an earlier run stored an auth user id, switch the column to a name.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tasks'
      and column_name = 'assigned_to'
      and udt_name = 'uuid'
  ) then
    drop index if exists public.idx_tasks_assignee_status;
    alter table public.tasks drop constraint if exists tasks_assigned_to_fkey;
    alter table public.tasks
      alter column assigned_to type text using assigned_to::text;
    delete from public.tasks
    where assigned_to not in ('Anurag', 'Abhinandan');
  end if;
end $$;

alter table public.tasks alter column assigned_to drop not null;

alter table public.tasks drop constraint if exists tasks_assigned_to_check;
alter table public.tasks
  add constraint tasks_assigned_to_check
  check (assigned_to is null or assigned_to in ('Anurag', 'Abhinandan'));

create index if not exists idx_tasks_status_due
  on public.tasks (status, due_at);

create index if not exists idx_tasks_assignee_status
  on public.tasks (assigned_to, status);

create index if not exists idx_tasks_pump
  on public.tasks (pump_id);

create index if not exists idx_tasks_pending_due
  on public.tasks (due_at)
  where status = 'pending';

create or replace function public.set_tasks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row
  execute function public.set_tasks_updated_at();

create or replace function public.enforce_task_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_to is not null and new.assigned_to not in ('Anurag', 'Abhinandan') then
    raise exception 'Tasks can only be assigned to Anurag or Abhinandan';
  end if;

  if tg_op = 'INSERT' and new.created_by is not null and not public.is_petrofi_admin_user(new.created_by) then
    raise exception 'Task creator must be a PetroFI admin';
  end if;

  if tg_op = 'UPDATE' then
    if old.pump_id is distinct from new.pump_id then
      raise exception 'A task cannot move to another pump';
    end if;
    if old.status <> 'pending' and new.status is distinct from old.status then
      raise exception 'Only a pending task can change status';
    end if;
    if new.status = 'completed' and new.completed_at is null then
      new.completed_at = now();
    end if;
    if new.status <> 'completed' then
      new.completed_at = null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_task_rules on public.tasks;
create trigger trg_enforce_task_rules
  before insert or update on public.tasks
  for each row
  execute function public.enforce_task_rules();

-- Completes a task, optionally writes one pump note, optionally creates the next task.
-- One transaction: any failure rolls the whole completion back.
drop function if exists public.complete_admin_task(uuid, text, text, text, uuid, boolean, text, text, uuid, timestamptz);

create or replace function public.complete_admin_task(
  p_task_id uuid,
  p_outcome text,
  p_note_body text,
  p_author_name text,
  p_actor_id uuid,
  p_schedule_next boolean,
  p_next_title text,
  p_next_type text,
  p_next_assigned_to text,
  p_next_due_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks%rowtype;
  v_note_id uuid;
  v_next_id uuid;
  v_note text;
begin
  if p_actor_id is null or not public.is_petrofi_admin_user(p_actor_id) then
    raise exception 'Only a PetroFI admin can complete a task';
  end if;

  select * into v_task
  from public.tasks
  where id = p_task_id
  for update;

  if not found then
    raise exception 'Task not found';
  end if;

  if v_task.status <> 'pending' then
    raise exception 'Only a pending task can be completed';
  end if;

  v_note := nullif(trim(coalesce(p_note_body, '')), '');
  if v_note is not null then
    insert into public.pump_notes (pump_id, body, note_type, follow_up_at, author_name)
    values (
      v_task.pump_id,
      v_note,
      case v_task.task_type
        when 'call' then 'call'
        when 'demo' then 'meeting'
        else 'follow_up'
      end,
      now(),
      nullif(trim(coalesce(p_author_name, '')), '')
    )
    returning id into v_note_id;
  end if;

  update public.tasks
  set
    status = 'completed',
    outcome = nullif(trim(coalesce(p_outcome, '')), ''),
    completed_at = now(),
    note_id = coalesce(v_note_id, note_id)
  where id = p_task_id;

  if coalesce(p_schedule_next, false) then
    if nullif(trim(coalesce(p_next_title, '')), '') is null then
      raise exception 'Next task needs a title';
    end if;
    if p_next_type is null or p_next_type not in ('call', 'demo', 'follow_up') then
      raise exception 'Next task type is invalid';
    end if;
    if p_next_due_at is null then
      raise exception 'Next task needs a due date';
    end if;
    if p_next_assigned_to is null or p_next_assigned_to not in ('Anurag', 'Abhinandan') then
      raise exception 'Next task must be assigned to Anurag or Abhinandan';
    end if;

    insert into public.tasks (pump_id, title, task_type, assigned_to, due_at, status, created_by)
    values (
      v_task.pump_id,
      trim(p_next_title),
      p_next_type,
      p_next_assigned_to,
      p_next_due_at,
      'pending',
      p_actor_id
    )
    returning id into v_next_id;
  end if;

  return jsonb_build_object(
    'task_id', p_task_id,
    'note_id', v_note_id,
    'next_task_id', v_next_id
  );
end;
$$;

revoke all on function public.complete_admin_task(uuid, text, text, text, uuid, boolean, text, text, text, timestamptz) from public;
revoke all on function public.complete_admin_task(uuid, text, text, text, uuid, boolean, text, text, text, timestamptz) from anon, authenticated;
grant execute on function public.complete_admin_task(uuid, text, text, text, uuid, boolean, text, text, text, timestamptz) to service_role;

alter table public.tasks enable row level security;

drop policy if exists tasks_admin_select on public.tasks;
drop policy if exists tasks_admin_insert on public.tasks;
drop policy if exists tasks_admin_update on public.tasks;
drop policy if exists tasks_admin_delete on public.tasks;

create policy tasks_admin_select on public.tasks
  for select
  using (public.is_admin_audit_actor());

create policy tasks_admin_insert on public.tasks
  for insert
  with check (
    public.is_admin_audit_actor()
    and (assigned_to is null or assigned_to in ('Anurag', 'Abhinandan'))
    and (created_by is null or public.is_petrofi_admin_user(created_by))
  );

create policy tasks_admin_update on public.tasks
  for update
  using (public.is_admin_audit_actor())
  with check (
    public.is_admin_audit_actor()
    and (assigned_to is null or assigned_to in ('Anurag', 'Abhinandan'))
  );

create policy tasks_admin_delete on public.tasks
  for delete
  using (public.is_admin_audit_actor());

-- New pump row = new registration. Creates one discovery call and does not change the pump.
create or replace function public.create_discovery_call_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_due timestamptz;
begin
  v_due := (
    (timezone('Asia/Kolkata', now()))::date + time '23:59:00'
  ) at time zone 'Asia/Kolkata';

  insert into public.tasks (
    pump_id,
    title,
    task_type,
    assigned_to,
    due_at,
    status,
    created_by
  ) values (
    new.id,
    'Need to do the discovery call',
    'call',
    null,
    v_due,
    'pending',
    null
  );

  return new;
end;
$$;

drop trigger if exists trg_create_discovery_call_task on public.pumps;

create trigger trg_create_discovery_call_task
  after insert on public.pumps
  for each row
  execute function public.create_discovery_call_task();
