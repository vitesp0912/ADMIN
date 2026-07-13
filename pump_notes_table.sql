-- ============================================
-- Follow-up notes / messages per pump (admin CRM)
-- Run after public.pumps exists.
-- ============================================

create table public.pump_notes (
  id uuid not null default gen_random_uuid(),
  pump_id uuid not null,
  body text not null,
  note_type text not null default 'follow_up',
  follow_up_at timestamp with time zone null,
  -- Display name of the admin who wrote the note (auth user; not FK to public.users)
  author_name text null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint pump_notes_pkey primary key (id),
  constraint pump_notes_pump_id_fkey foreign key (pump_id) references public.pumps (id) on delete cascade,
  constraint pump_notes_created_by_fkey foreign key (created_by) references public.users (id) on delete set null,
  constraint pump_notes_body_not_empty check (length(trim(body)) > 0),
  constraint pump_notes_note_type_check check (
    note_type in ('general', 'follow_up', 'call', 'whatsapp', 'meeting', 'issue', 'other')
  )
) tablespace pg_default;

-- If pump_notes already exists without author_name:
-- alter table public.pump_notes add column if not exists author_name text null;

create index if not exists idx_pump_notes_pump_id
  on public.pump_notes using btree (pump_id) tablespace pg_default;

create index if not exists idx_pump_notes_pump_created
  on public.pump_notes using btree (pump_id, created_at desc) tablespace pg_default;

create index if not exists idx_pump_notes_follow_up
  on public.pump_notes using btree (follow_up_at)
  where follow_up_at is not null;

-- Optional: keep updated_at in sync (reuse your existing trigger function if you have one)
create or replace function public.update_pump_notes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trigger_update_pump_notes_updated_at on public.pump_notes;

create trigger trigger_update_pump_notes_updated_at
  before update on public.pump_notes
  for each row
  execute function public.update_pump_notes_updated_at();

alter table public.pump_notes enable row level security;

drop policy if exists "Authenticated users can select pump_notes" on public.pump_notes;
drop policy if exists "Authenticated users can insert pump_notes" on public.pump_notes;
drop policy if exists "Authenticated users can update pump_notes" on public.pump_notes;
drop policy if exists "Authenticated users can delete pump_notes" on public.pump_notes;

create policy "Authenticated users can select pump_notes" on public.pump_notes
  for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert pump_notes" on public.pump_notes
  for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update pump_notes" on public.pump_notes
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can delete pump_notes" on public.pump_notes
  for delete
  using (auth.role() = 'authenticated');
