-- ============================================
-- Discovery call on new pump registration
-- ============================================
-- After a new row is inserted into public.pumps, add one pending task:
--   title:       Need to do the discovery call
--   type:        call
--   assignee:    none
--   due:         the same calendar day at 11:59pm IST
--
-- Existing pumps are not changed. No tasks are created for pumps already stored.
-- Pump name, subscription, users, notes, and readings are not updated.
--
-- Run this in the Supabase SQL editor after tasks_table.sql has been applied.
-- Safe to re-run.
-- ============================================

alter table public.tasks alter column assigned_to drop not null;

alter table public.tasks drop constraint if exists tasks_assigned_to_check;
alter table public.tasks
  add constraint tasks_assigned_to_check
  check (assigned_to is null or assigned_to in ('Anurag', 'Abhinandan'));

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

drop policy if exists tasks_admin_insert on public.tasks;
drop policy if exists tasks_admin_update on public.tasks;

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
