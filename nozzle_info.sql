create table public.nozzle_info (
  pump_id uuid not null,
  nozzle_id uuid not null default gen_random_uuid (),
  fuel_type character varying(50) not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  initial_meter_reading numeric(18, 2) not null,
  fuel_type_id uuid null,
  nozzle_number integer null,
  name text null,
  tank_id uuid null,
  is_active boolean not null default true,
  constraint nozzle_info_pkey primary key (pump_id, nozzle_id),
  constraint nozzle_info_fuel_type_id_fkey foreign KEY (fuel_type_id) references fuel_types (id) on delete set null,
  constraint nozzle_info_pump_id_fkey foreign KEY (pump_id) references pumps (id) on delete CASCADE,
  constraint nozzle_info_tank_id_fkey foreign KEY (tank_id) references tanks (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_nozzle_info_fuel_type_id on public.nozzle_info using btree (fuel_type_id) TABLESPACE pg_default;

create index IF not exists idx_nozzle_info_pump_id on public.nozzle_info using btree (pump_id) TABLESPACE pg_default;

create index IF not exists idx_nozzle_info_nozzle_id on public.nozzle_info using btree (nozzle_id) TABLESPACE pg_default;

create index IF not exists idx_nozzle_info_pump_nozzle on public.nozzle_info using btree (pump_id, nozzle_id) TABLESPACE pg_default;

create index IF not exists idx_nozzle_info_fuel_type on public.nozzle_info using btree (fuel_type) TABLESPACE pg_default;

create index IF not exists idx_nozzle_info_tank_id on public.nozzle_info using btree (tank_id) TABLESPACE pg_default;

create index IF not exists idx_nozzle_info_pump_active on public.nozzle_info using btree (pump_id, is_active) TABLESPACE pg_default
where
  (is_active = true);

create trigger trigger_update_nozzle_info_updated_at BEFORE
update on nozzle_info for EACH row
execute FUNCTION update_nozzle_info_updated_at ();