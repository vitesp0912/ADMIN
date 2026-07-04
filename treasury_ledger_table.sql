-- ============================================
-- Treasury ledger (transactions between buckets)
-- Run after public.pumps and public.treasury_buckets exist.
-- Requires trigger functions on your DB if you use the triggers below.
-- ============================================

create table public.treasury_ledger (
  id uuid not null default gen_random_uuid(),
  pump_id uuid not null,
  business_date date not null,
  amount numeric(14, 2) not null,
  transaction_type character varying(50) not null,
  from_bucket_id uuid null,
  to_bucket_id uuid null,
  source_type character varying(50) null,
  source_id text null,
  reference_number character varying(80) null,
  note text null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  deleted_by uuid null,
  constraint treasury_ledger_pkey primary key (id),
  constraint treasury_ledger_pump_id_fkey foreign key (pump_id) references public.pumps (id) on delete cascade,
  constraint treasury_ledger_to_bucket_id_fkey foreign key (to_bucket_id) references public.treasury_buckets (id) on delete restrict,
  constraint treasury_ledger_created_by_fkey foreign key (created_by) references public.users (id) on delete set null,
  constraint treasury_ledger_deleted_by_fkey foreign key (deleted_by) references public.users (id) on delete set null,
  constraint treasury_ledger_from_bucket_id_fkey foreign key (from_bucket_id) references public.treasury_buckets (id) on delete restrict,
  constraint treasury_ledger_transaction_type_check check (
    (transaction_type)::text = any (
      array[
        'meter_cash_sales'::text,
        'meter_sales_provisional'::text,
        'digital_sale_to_bank'::text,
        'credit_sale_from_cash'::text,
        'cash_deposit'::text,
        'current_to_inhand'::text,
        'transfer_to_company'::text,
        'transfer_between_current'::text,
        'bank_charge'::text,
        'bank_interest'::text,
        'company_bonus'::text,
        'company_penalty'::text,
        'company_charge'::text,
        'expense_payment'::text,
        'credit_payment_received'::text,
        'fuel_receipt_payment'::text,
        'other_transaction'::text
      ]
    )
  ),
  constraint treasury_ledger_check check (
    (from_bucket_id is not null) or (to_bucket_id is not null)
  ),
  constraint treasury_ledger_check1 check (
    (from_bucket_id is null) or (to_bucket_id is null) or (from_bucket_id <> to_bucket_id)
  ),
  constraint treasury_ledger_amount_check check ((amount > (0)::numeric))
) tablespace pg_default;

create unique index if not exists idx_treasury_ledger_source_unique
  on public.treasury_ledger using btree (pump_id, source_type, source_id, transaction_type) tablespace pg_default
  where (
    (source_type is not null)
    and (source_id is not null)
    and (deleted_at is null)
  );

create unique index if not exists idx_treasury_ledger_active_source_unique
  on public.treasury_ledger using btree (pump_id, source_type, source_id) tablespace pg_default
  where (
    (deleted_at is null)
    and (source_type is not null)
    and (source_id is not null)
  );

create unique index if not exists idx_treasury_ledger_active_reference_unique
  on public.treasury_ledger using btree (pump_id, reference_number) tablespace pg_default
  where (
    (deleted_at is null)
    and (source_id is null)
    and (reference_number is not null)
  );

create index if not exists idx_treasury_ledger_pump_date
  on public.treasury_ledger using btree (pump_id, business_date desc) tablespace pg_default;

create index if not exists idx_treasury_ledger_active
  on public.treasury_ledger using btree (pump_id, business_date) tablespace pg_default
  where (deleted_at is null);

create index if not exists idx_treasury_ledger_bucket_statement
  on public.treasury_ledger using btree (pump_id, business_date desc, created_at desc) tablespace pg_default
  where (deleted_at is null);

alter table public.treasury_ledger enable row level security;

drop policy if exists "Authenticated users can select treasury_ledger" on public.treasury_ledger;
drop policy if exists "Authenticated users can insert treasury_ledger" on public.treasury_ledger;
drop policy if exists "Authenticated users can update treasury_ledger" on public.treasury_ledger;
drop policy if exists "Authenticated users can delete treasury_ledger" on public.treasury_ledger;

create policy "Authenticated users can select treasury_ledger" on public.treasury_ledger
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert treasury_ledger" on public.treasury_ledger
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update treasury_ledger" on public.treasury_ledger
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can delete treasury_ledger" on public.treasury_ledger
  for delete using (auth.role() = 'authenticated');
