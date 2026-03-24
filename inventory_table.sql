-- ============================================
-- Inventory per pump (convenience store / shop stock)
-- Run in Supabase SQL Editor after pumps table exists.
-- ============================================

create table public.inventory (
  id uuid not null default gen_random_uuid(),
  name character varying(255) not null,
  quantity integer not null default 0,
  cost_price numeric(10, 2) not null,
  selling_price numeric(10, 2) null,
  expiry_date date null,
  created_at timestamp without time zone not null default now(),
  pump_id uuid not null,
  batch_number text null,
  constraint inventory_pkey primary key (id),
  constraint inventory_pump_id_fkey foreign key (pump_id) references public.pumps (id) on delete cascade,
  constraint inventory_cost_price_gt_0 check ((cost_price > (0)::numeric)),
  constraint inventory_quantity_gte_0 check ((quantity >= 0)),
  constraint inventory_selling_price_gt_0 check (
    (
      (selling_price is null)
      or (selling_price > (0)::numeric)
    )
  )
) tablespace pg_default;

create index if not exists idx_inventory_pump_id
  on public.inventory using btree (pump_id) tablespace pg_default;

alter table public.inventory enable row level security;

drop policy if exists "Authenticated users can select inventory" on public.inventory;
drop policy if exists "Authenticated users can insert inventory" on public.inventory;
drop policy if exists "Authenticated users can update inventory" on public.inventory;
drop policy if exists "Authenticated users can delete inventory" on public.inventory;

create policy "Authenticated users can select inventory" on public.inventory
  for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert inventory" on public.inventory
  for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update inventory" on public.inventory
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can delete inventory" on public.inventory
  for delete
  using (auth.role() = 'authenticated');
