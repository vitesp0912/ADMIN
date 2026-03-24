-- ============================================
-- Udhar (credit) ledger — transactions per customer & pump
-- Run in Supabase SQL Editor after pumps, customers, and users exist.
-- ============================================

create table public.udhar_ledger (
  id uuid not null default gen_random_uuid(),
  pump_id uuid not null,
  user_id uuid not null,
  vehicle_number character varying(20) null,
  entry_type character varying(10) not null,
  amount numeric(15, 2) not null,
  business_date date not null,
  note text null,
  created_at timestamp with time zone not null default now(),
  customer_id uuid not null,
  constraint udhar_ledger_pkey primary key (id),
  constraint udhar_ledger_customer_id_fkey foreign key (customer_id) references public.customers (id),
  constraint udhar_ledger_pump_id_fkey foreign key (pump_id) references public.pumps (id) on delete cascade,
  constraint udhar_ledger_user_id_fkey foreign key (user_id) references public.users (id) on delete cascade,
  constraint udhar_ledger_amount_check check ((amount > (0)::numeric)),
  constraint udhar_ledger_entry_type_check check (
    (
      (entry_type)::text = any (
        (
          array[
            'credit'::character varying,
            'payment'::character varying
          ]
        )::text[]
      )
    )
  )
) tablespace pg_default;

-- Indexes (duplicate single-column entry_type / customer_id definitions from your list merged into one each)
create index if not exists idx_udhar_ledger_balance_calc
  on public.udhar_ledger using btree (customer_id, pump_id, entry_type, amount) tablespace pg_default;

create index if not exists idx_udhar_pump_date
  on public.udhar_ledger using btree (pump_id, business_date) tablespace pg_default;

create index if not exists idx_udhar_entry_type
  on public.udhar_ledger using btree (entry_type) tablespace pg_default;

create index if not exists idx_udhar_customer_id
  on public.udhar_ledger using btree (customer_id) tablespace pg_default;

create index if not exists idx_udhar_ledger_customer_pump
  on public.udhar_ledger using btree (customer_id, pump_id) tablespace pg_default;

create index if not exists idx_udhar_ledger_created_at
  on public.udhar_ledger using btree (created_at desc) tablespace pg_default;

create index if not exists idx_udhar_ledger_business_date
  on public.udhar_ledger using btree (business_date desc) tablespace pg_default;

create index if not exists idx_udhar_ledger_recent
  on public.udhar_ledger using btree (customer_id, pump_id, created_at desc) tablespace pg_default;

create index if not exists idx_udhar_ledger_pump_id
  on public.udhar_ledger using btree (pump_id) tablespace pg_default;

alter table public.udhar_ledger enable row level security;

drop policy if exists "Authenticated users can select udhar_ledger" on public.udhar_ledger;
drop policy if exists "Authenticated users can insert udhar_ledger" on public.udhar_ledger;
drop policy if exists "Authenticated users can update udhar_ledger" on public.udhar_ledger;
drop policy if exists "Authenticated users can delete udhar_ledger" on public.udhar_ledger;

create policy "Authenticated users can select udhar_ledger" on public.udhar_ledger
  for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert udhar_ledger" on public.udhar_ledger
  for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update udhar_ledger" on public.udhar_ledger
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can delete udhar_ledger" on public.udhar_ledger
  for delete
  using (auth.role() = 'authenticated');
