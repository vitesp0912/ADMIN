create table public.fuel_types (
  id uuid not null default gen_random_uuid (),
  pump_id uuid not null,
  name character varying(50) not null,
  rsp numeric(10, 2) not null default 0.0,
  ro_price numeric(10, 2) not null default 0.0,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint fuel_types_pkey primary key (id),
  constraint fuel_types_pump_id_fkey foreign KEY (pump_id) references pumps (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_fuel_types_pump_id on public.fuel_types using btree (pump_id) TABLESPACE pg_default;

create index IF not exists idx_fuel_types_name on public.fuel_types using btree (name) TABLESPACE pg_default;

create index IF not exists idx_fuel_types_pump_active on public.fuel_types using btree (pump_id, is_active) TABLESPACE pg_default;

create index IF not exists idx_fuel_types_pump_order on public.fuel_types using btree (pump_id, display_order) TABLESPACE pg_default;

create unique INDEX IF not exists idx_fuel_types_pump_name_unique on public.fuel_types using btree (pump_id, lower((name)::text)) TABLESPACE pg_default;

create trigger trigger_update_fuel_types_updated_at BEFORE
update on fuel_types for EACH row
execute FUNCTION update_fuel_types_updated_at ();