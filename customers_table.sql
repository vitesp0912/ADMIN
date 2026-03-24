-- ============================================
-- Customers per pump (unique phone per pump)
-- Run in Supabase SQL Editor after pumps table exists.
-- ============================================

create table public.customers (
  id uuid not null default gen_random_uuid(),
  pump_id uuid not null,
  name text not null,
  phone character varying(15) not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null default now(),
  constraint customers_pkey primary key (id),
  constraint customers_pump_phone_key unique (pump_id, phone),
  constraint customers_pump_id_fkey foreign key (pump_id) references public.pumps (id) on delete cascade
) tablespace pg_default;

create index if not exists idx_customers_pump_phone
  on public.customers using btree (pump_id, phone) tablespace pg_default;

create index if not exists idx_customers_pump_id
  on public.customers using btree (pump_id) tablespace pg_default;

alter table public.customers enable row level security;

drop policy if exists "Authenticated users can select customers" on public.customers;
drop policy if exists "Authenticated users can insert customers" on public.customers;
drop policy if exists "Authenticated users can update customers" on public.customers;
drop policy if exists "Authenticated users can delete customers" on public.customers;

create policy "Authenticated users can select customers" on public.customers
  for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert customers" on public.customers
  for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update customers" on public.customers
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can delete customers" on public.customers
  for delete
  using (auth.role() = 'authenticated');
