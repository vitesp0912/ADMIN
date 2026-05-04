-- ============================================
-- Tanks per pump (tank configuration)
-- Run after public.pumps and public.fuel_types exist.
-- ============================================

create table public.tanks (
  id uuid not null default gen_random_uuid(),
  pump_id uuid not null,
  name text not null,
  capacity_liters numeric(12, 3) not null,
  fuel_type uuid not null,
  is_active boolean not null default true,
  initial_volume_liters numeric(12, 3) not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  initial_dip_cm numeric(10, 2) not null default 0,
  current_volume_liters numeric(12, 3) not null default 0,
  constraint tanks_pkey primary key (id),
  constraint tanks_fuel_type_fkey foreign key (fuel_type) references public.fuel_types (id) on delete restrict,
  constraint tanks_pump_id_fkey foreign key (pump_id) references public.pumps (id) on delete cascade,
  constraint tanks_current_volume_liters_check check ((current_volume_liters >= (0)::numeric)),
  constraint tanks_current_volume_not_more_than_capacity_check check ((current_volume_liters <= capacity_liters)),
  constraint tanks_initial_dip_cm_check check ((initial_dip_cm >= (0)::numeric))
) tablespace pg_default;

create index if not exists idx_tanks_fuel_type
  on public.tanks using btree (fuel_type) tablespace pg_default;

create index if not exists idx_tanks_pump_id
  on public.tanks using btree (pump_id) tablespace pg_default;

alter table public.tanks enable row level security;

drop policy if exists "Authenticated users can select tanks" on public.tanks;
drop policy if exists "Authenticated users can insert tanks" on public.tanks;
drop policy if exists "Authenticated users can update tanks" on public.tanks;
drop policy if exists "Authenticated users can delete tanks" on public.tanks;

create policy "Authenticated users can select tanks" on public.tanks
  for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert tanks" on public.tanks
  for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update tanks" on public.tanks
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can delete tanks" on public.tanks
  for delete
  using (auth.role() = 'authenticated');
