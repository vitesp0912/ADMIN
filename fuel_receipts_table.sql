-- ============================================
-- Fuel receipts (deliveries into tanks)
-- Run after public.pumps, public.tanks, public.fuel_types exist.
-- ============================================

create table public.fuel_receipts (
  id uuid not null default gen_random_uuid(),
  pump_id uuid not null,
  tank_id uuid not null,
  fuel_type_id uuid not null,
  user_id uuid null,
  receipt_date date not null default current_date,
  date_time timestamp with time zone not null default now(),
  quantity_liters numeric(12, 3) not null,
  invoice_number text null,
  supplier_name text null,
  notes text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fuel_receipts_pkey primary key (id),
  constraint fuel_receipts_fuel_type_id_fkey foreign key (fuel_type_id) references public.fuel_types (id) on delete restrict,
  constraint fuel_receipts_pump_id_fkey foreign key (pump_id) references public.pumps (id) on delete cascade,
  constraint fuel_receipts_tank_id_fkey foreign key (tank_id) references public.tanks (id) on delete restrict,
  constraint fuel_receipts_user_id_fkey foreign key (user_id) references public.users (id) on delete set null,
  constraint fuel_receipts_quantity_liters_check check ((quantity_liters > (0)::numeric))
) tablespace pg_default;

create index if not exists idx_fuel_receipts_pump_id
  on public.fuel_receipts using btree (pump_id) tablespace pg_default;

create index if not exists idx_fuel_receipts_tank_id
  on public.fuel_receipts using btree (tank_id) tablespace pg_default;

create index if not exists idx_fuel_receipts_receipt_date
  on public.fuel_receipts using btree (receipt_date desc) tablespace pg_default;

alter table public.fuel_receipts enable row level security;

drop policy if exists "Authenticated users can select fuel_receipts" on public.fuel_receipts;
drop policy if exists "Authenticated users can insert fuel_receipts" on public.fuel_receipts;
drop policy if exists "Authenticated users can update fuel_receipts" on public.fuel_receipts;
drop policy if exists "Authenticated users can delete fuel_receipts" on public.fuel_receipts;

create policy "Authenticated users can select fuel_receipts" on public.fuel_receipts
  for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert fuel_receipts" on public.fuel_receipts
  for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update fuel_receipts" on public.fuel_receipts
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can delete fuel_receipts" on public.fuel_receipts
  for delete
  using (auth.role() = 'authenticated');
