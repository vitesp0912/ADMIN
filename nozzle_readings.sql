create table public.nozzle_reading (
  id uuid not null default gen_random_uuid (),
  pump_id uuid not null,
  nozzle_id uuid not null,
  opening_reading numeric(18, 2) not null,
  closing_reading numeric(18, 2) null,
  date date not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  fuel_type_id uuid null,
  rsp_applied numeric(10, 3) null,
  ro_price_applied numeric(10, 3) null,
  sales numeric GENERATED ALWAYS as ((closing_reading - opening_reading)) STORED (18, 2) null,
  testing_amount_liters numeric(12, 3) not null default 0,
  net_dispensed_liters numeric GENERATED ALWAYS as (
    case
      when (closing_reading is null) then null::numeric
      else (
        (closing_reading - opening_reading) - testing_amount_liters
      )
    end
  ) STORED (18, 3) null,
  net_sales_amount numeric GENERATED ALWAYS as (
    case
      when (
        (closing_reading is null)
        or (rsp_applied is null)
      ) then null::numeric
      else (
        (
          (closing_reading - opening_reading) - testing_amount_liters
        ) * rsp_applied
      )
    end
  ) STORED (18, 3) null,
  gross_profit_amount numeric GENERATED ALWAYS as (
    case
      when (
        (closing_reading is null)
        or (rsp_applied is null)
        or (ro_price_applied is null)
      ) then null::numeric
      else (
        (
          (closing_reading - opening_reading) - testing_amount_liters
        ) * (rsp_applied - ro_price_applied)
      )
    end
  ) STORED (18, 3) null,
  tank_id uuid null,
  tank_transaction_id uuid null,
  treasury_ledger_id uuid null,
  shift_id uuid null,
  constraint nozzle_reading_pkey primary key (id),
  constraint nozzle_reading_fuel_type_id_fkey foreign KEY (fuel_type_id) references fuel_types (id) on delete set null,
  constraint nozzle_reading_pump_id_fkey foreign KEY (pump_id) references pumps (id) on delete CASCADE,
  constraint nozzle_reading_pump_id_nozzle_id_fkey foreign KEY (pump_id, nozzle_id) references nozzle_info (pump_id, nozzle_id) on delete CASCADE,
  constraint nozzle_reading_shift_id_fkey foreign KEY (shift_id) references shifts (id) on delete RESTRICT,
  constraint nozzle_reading_tank_id_fkey foreign KEY (tank_id) references tanks (id) on delete set null,
  constraint nozzle_reading_tank_transaction_id_fkey foreign KEY (tank_transaction_id) references tank_transactions (id) on delete set null,
  constraint nozzle_reading_treasury_ledger_id_fkey foreign KEY (treasury_ledger_id) references treasury_ledger (id) on delete set null,
  constraint nozzle_reading_testing_amount_liters_check check ((testing_amount_liters >= (0)::numeric)),
  constraint check_reading_order check (
    (
      (closing_reading is null)
      or (closing_reading >= opening_reading)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_nozzle_reading_pump_date on public.nozzle_reading using btree (pump_id, date desc) TABLESPACE pg_default
where
  (closing_reading is not null);

create index IF not exists idx_nozzle_reading_fuel_type_id on public.nozzle_reading using btree (fuel_type_id) TABLESPACE pg_default;

create index IF not exists idx_nozzle_reading_price_snapshots on public.nozzle_reading using btree (rsp_applied, ro_price_applied) TABLESPACE pg_default
where
  (
    (rsp_applied is not null)
    and (ro_price_applied is not null)
  );

create index IF not exists idx_nozzle_reading_pump_id on public.nozzle_reading using btree (pump_id) TABLESPACE pg_default;

create index IF not exists idx_nozzle_reading_nozzle_id on public.nozzle_reading using btree (nozzle_id) TABLESPACE pg_default;

create index IF not exists idx_nozzle_reading_date on public.nozzle_reading using btree (date) TABLESPACE pg_default;

create index IF not exists idx_nozzle_reading_pump_nozzle_date on public.nozzle_reading using btree (pump_id, nozzle_id, date desc) TABLESPACE pg_default;

create index IF not exists idx_nozzle_reading_tank_id on public.nozzle_reading using btree (tank_id) TABLESPACE pg_default;

create index IF not exists idx_nozzle_reading_tank_transaction_id on public.nozzle_reading using btree (tank_transaction_id) TABLESPACE pg_default;

create index IF not exists idx_nozzle_reading_fuel_type_date_recalc on public.nozzle_reading using btree (fuel_type_id, date) TABLESPACE pg_default
where
  (fuel_type_id is not null);

create index IF not exists idx_nozzle_reading_treasury_ledger_id on public.nozzle_reading using btree (treasury_ledger_id) TABLESPACE pg_default
where
  (treasury_ledger_id is not null);

create unique INDEX IF not exists uq_nozzle_reading_legacy_day on public.nozzle_reading using btree (pump_id, nozzle_id, date) TABLESPACE pg_default
where
  (shift_id is null);

create unique INDEX IF not exists uq_nozzle_reading_pump_nozzle_date_shift on public.nozzle_reading using btree (pump_id, nozzle_id, date, shift_id) TABLESPACE pg_default
where
  (shift_id is not null);

create index IF not exists idx_nozzle_reading_report_pump_date_closed on public.nozzle_reading using btree (pump_id, date desc) TABLESPACE pg_default
where
  (closing_reading is not null);

create index IF not exists idx_nozzle_reading_report_pump_fuel_date_closed on public.nozzle_reading using btree (pump_id, fuel_type_id, date desc) TABLESPACE pg_default
where
  (
    (closing_reading is not null)
    and (fuel_type_id is not null)
  );

create index IF not exists idx_nozzle_reading_shift_id on public.nozzle_reading using btree (shift_id) TABLESPACE pg_default
where
  (shift_id is not null);

create index IF not exists idx_nozzle_reading_pump_shift on public.nozzle_reading using btree (pump_id, shift_id) TABLESPACE pg_default
where
  (shift_id is not null);

create index IF not exists idx_nozzle_reading_pump_nozzle_date_shift on public.nozzle_reading using btree (pump_id, nozzle_id, date, shift_id) TABLESPACE pg_default;

create trigger trg_sync_nozzle_reading_treasury_delta
after
update on nozzle_reading for EACH row when (
  old.net_sales_amount is distinct from new.net_sales_amount
  and new.treasury_ledger_id is not null
)
execute FUNCTION sync_nozzle_reading_treasury_delta ();

create trigger trigger_update_nozzle_reading_updated_at BEFORE
update on nozzle_reading for EACH row
execute FUNCTION update_nozzle_reading_updated_at ();