-- ============================================
-- Treasury buckets (cash + bank accounts per pump)
-- Run after public.pumps exists.
-- ============================================

create table public.treasury_buckets (
  id uuid not null default gen_random_uuid(),
  pump_id uuid not null,
  bucket_type character varying(30) not null,
  name character varying(120) not null,
  company_name text null,
  bank_name character varying(120) null,
  account_number_last_four character varying(4) null,
  opening_balance numeric(14, 2) not null default 0,
  opening_balance_as_of date not null default current_date,
  current_balance numeric(14, 2) not null default 0,
  is_system_bucket boolean not null default false,
  is_active boolean not null default true,
  display_order integer not null default 0,
  notes text null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint treasury_buckets_pkey primary key (id),
  constraint treasury_buckets_created_by_fkey foreign key (created_by) references public.users (id) on delete set null,
  constraint treasury_buckets_pump_id_fkey foreign key (pump_id) references public.pumps (id) on delete cascade,
  constraint treasury_buckets_account_number_last_four_check check (
    (account_number_last_four is null)
    or ((account_number_last_four)::text ~ '^\d{4}$'::text)
  ),
  constraint treasury_buckets_bucket_type_check check (
    (bucket_type)::text = any (
      array[
        'IN_HAND_CASH'::character varying,
        'CURRENT_ACCOUNT'::character varying,
        'COMPANY_ACCOUNT'::character varying
      ]::text[]
    )
  ),
  constraint treasury_buckets_display_order_check check ((display_order >= 0))
) tablespace pg_default;

create unique index if not exists idx_treasury_buckets_one_cash_per_pump
  on public.treasury_buckets using btree (pump_id) tablespace pg_default
  where ((bucket_type)::text = 'IN_HAND_CASH'::text);

create unique index if not exists idx_treasury_buckets_pump_name_unique
  on public.treasury_buckets using btree (
    pump_id,
    lower(trim(both from name))
  ) tablespace pg_default;

create index if not exists idx_treasury_buckets_pump_type_active
  on public.treasury_buckets using btree (pump_id, bucket_type, is_active) tablespace pg_default;

alter table public.treasury_buckets enable row level security;

drop policy if exists "Authenticated users can select treasury_buckets" on public.treasury_buckets;
drop policy if exists "Authenticated users can insert treasury_buckets" on public.treasury_buckets;
drop policy if exists "Authenticated users can update treasury_buckets" on public.treasury_buckets;
drop policy if exists "Authenticated users can delete treasury_buckets" on public.treasury_buckets;

create policy "Authenticated users can select treasury_buckets" on public.treasury_buckets
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert treasury_buckets" on public.treasury_buckets
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update treasury_buckets" on public.treasury_buckets
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can delete treasury_buckets" on public.treasury_buckets
  for delete using (auth.role() = 'authenticated');
