create table public.shifts (
  id uuid not null default gen_random_uuid (),
  pump_id uuid not null,
  name text not null,
  sequence smallint not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint shifts_pkey primary key (id),
  constraint shifts_pump_id_fkey foreign KEY (pump_id) references pumps (id) on delete CASCADE,
  constraint shifts_sequence_positive check ((sequence > 0)),
  constraint trg_validate_shifts_coverage TRIGGER deferrable initially DEFERRED
) TABLESPACE pg_default;

create unique INDEX IF not exists shifts_pump_sequence_active_unique on public.shifts using btree (pump_id, sequence) TABLESPACE pg_default
where
  is_active;

create unique INDEX IF not exists shifts_pump_name_active_unique on public.shifts using btree (pump_id, lower(btrim(name))) TABLESPACE pg_default
where
  is_active;

create index IF not exists idx_shifts_pump_id on public.shifts using btree (pump_id) TABLESPACE pg_default;

create index IF not exists idx_shifts_pump_active_sequence on public.shifts using btree (pump_id, is_active, sequence) TABLESPACE pg_default;

create trigger trg_shifts_normalize_row BEFORE INSERT
or
update OF name on shifts for EACH row
execute FUNCTION shifts_normalize_row ();

create trigger trg_shifts_updated_at BEFORE
update on shifts for EACH row
execute FUNCTION update_shifts_updated_at ();

create constraint TRIGGER trg_validate_shifts_coverage
after INSERT
or DELETE
or
update on shifts deferrable initially DEFERRED for EACH row
execute FUNCTION trg_validate_shifts_coverage_fn ();