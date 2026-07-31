-- ============================================
-- Admin configure-on-behalf (fuel / shifts / nozzles)
-- ============================================
-- Purpose:
--   Admin panel completes pump onboarding for a dealer without logging in
--   as that user. Same tables as the Flutter app; same business rules.
--
-- Isolation from the Flutter app path (IMPORTANT):
--   • Does NOT replace sync_pump_shifts, insert_nozzle_info, add_fuel_price,
--     or any dealer-facing RPC. Names are all admin_* / _admin_*.
--   • Creates NO triggers on fuel_types / shifts / nozzle_* — app inserts
--     via AuthService / sync_pump_shifts are unchanged.
--   • EXECUTE is granted to service_role ONLY. Explicitly revoked from
--     PUBLIC, anon, and authenticated so the Flutter client cannot call
--     these RPCs even if someone tries.
--   • Flutter must keep using AuthService.saveFuelTypes / saveNozzles and
--     SupabaseService.syncPumpShifts — never admin_*.
--   • Works for pending AND approved pumps. Admin functions set
--     row_security = off so table RLS (which often requires
--     registration_status = approved) does NOT block writes. Rejected pumps
--     are blocked in _admin_assert_pump_exists. Dealer login still needs
--     approval afterward; configured data makes getOnboardingStep() skip.
--
-- Constraint policy (mirrors app validators, admin entry only):
--   Fuel: 1–27, FuelType enum display names (case-sensitive), prices
--         0–200, rsp > 0, ro < rsp, unique names in payload
--   Shifts: 1–4 active, unique names + start times, full-day inclusive
--           coverage (each end = 1 minute before next start; sum = 1440)
--   Nozzles: 1–25, shift on this pump, meter date not after CURRENT_DATE,
--            initial_meter_reading >= 0, fuel_type belongs to pump
--
-- After fuel_types + nozzle_info exist, AuthService.getOnboardingStep()
-- returns null (data-driven; no admin trigger involved).
--
-- Apply in Supabase SQL Editor after fuel/shifts/nozzle tables exist.
-- ============================================

-- ---------------------------------------------------------------------------
-- Allowed fuel type names (FuelType enum displayName — case-sensitive)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION _admin_is_allowed_fuel_type_name(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_name = ANY (ARRAY[
    'Petrol 91',
    'Petrol XP95',
    'Petrol Speed 97',
    'Petrol Power 99',
    'Petrol XP100',
    'Petrol Premium Generic',
    'Petrol E10',
    'Petrol E20',
    'Diesel Regular',
    'Diesel Xtragreen',
    'Diesel Speed',
    'Diesel Hispeed',
    'Diesel Turbojet',
    'Diesel Premium Generic',
    'Diesel Biodiesel B5',
    'Diesel Biodiesel B7',
    'Diesel Biodiesel B100',
    'Diesel Industrial',
    'Kerosene PDS',
    'Kerosene SKO',
    'Kerosene Industrial',
    'ATF',
    'AVGAS',
    'Marine Diesel Oil',
    'Marine Gas Oil',
    'Marine Fuel HSFO',
    'Marine Fuel VLSFO'
  ]::TEXT[]);
$$;

-- Grants are applied in the lockdown block at the end of this file.

CREATE OR REPLACE FUNCTION _admin_assert_pump_exists(p_pump_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF p_pump_id IS NULL THEN
    RAISE EXCEPTION 'pump_id is required'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT (registration_status)::text INTO v_status
  FROM pumps
  WHERE id = p_pump_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pump not found: %', p_pump_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- Pending and approved are both allowed (admin configure-on-behalf).
  -- Unlike sync_pump_shifts, we do NOT require registration_status = approved.
  IF v_status = 'rejected' THEN
    RAISE EXCEPTION 'Cannot configure a rejected pump'
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

-- Grants are applied in the lockdown block at the end of this file.

-- Time helpers (UI HH:MM inclusive; DB may store :00 / :59)
CREATE OR REPLACE FUNCTION _admin_time_to_minutes(p_time TIME)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (EXTRACT(HOUR FROM p_time)::INT * 60) + EXTRACT(MINUTE FROM p_time)::INT;
$$;

CREATE OR REPLACE FUNCTION _admin_minutes_to_time(p_minutes INT)
RETURNS TIME
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT make_time(
    ((p_minutes % 1440) + 1440) % 1440 / 60,
    ((p_minutes % 1440) + 1440) % 1440 % 60,
    0
  );
$$;

CREATE OR REPLACE FUNCTION _admin_shift_duration_minutes(p_start TIME, p_end TIME)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _admin_time_to_minutes(p_end) >= _admin_time_to_minutes(p_start)
      THEN _admin_time_to_minutes(p_end) - _admin_time_to_minutes(p_start) + 1
    ELSE (1440 - _admin_time_to_minutes(p_start)) + _admin_time_to_minutes(p_end) + 1
  END;
$$;

-- Validate active shifts like ShiftCoverageValidator.validateActive
CREATE OR REPLACE FUNCTION _admin_validate_active_shifts(p_shifts JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_active JSONB := '[]'::JSONB;
  v_item JSONB;
  v_name TEXT;
  v_names TEXT[] := ARRAY[]::TEXT[];
  v_starts INT[] := ARRAY[]::INT[];
  v_start_m INT;
  v_end_m INT;
  v_expected_end INT;
  v_total INT := 0;
  v_i INT;
  v_n INT;
  v_cur JSONB;
  v_next JSONB;
BEGIN
  IF p_shifts IS NULL OR jsonb_typeof(p_shifts) <> 'array' THEN
    RAISE EXCEPTION 'shifts payload must be a JSON array'
      USING ERRCODE = 'check_violation';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_shifts)
  LOOP
    IF COALESCE((v_item->>'is_active')::BOOLEAN, TRUE) THEN
      v_active := v_active || jsonb_build_array(v_item);
    END IF;
  END LOOP;

  v_n := jsonb_array_length(v_active);
  IF v_n = 0 THEN
    RAISE EXCEPTION 'At least one active shift is required'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_n > 4 THEN
    RAISE EXCEPTION 'Maximum of 4 shifts allowed'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Sort by sequence
  SELECT COALESCE(jsonb_agg(value ORDER BY (value->>'sequence')::INT, value->>'name'), '[]'::JSONB)
  INTO v_active
  FROM jsonb_array_elements(v_active) AS t(value);

  FOR v_i IN 0 .. v_n - 1
  LOOP
    v_cur := v_active -> v_i;
    v_name := btrim(COALESCE(v_cur->>'name', ''));
    IF v_name = '' THEN
      RAISE EXCEPTION 'Shift name cannot be empty'
        USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (
      SELECT 1 FROM unnest(v_names) AS n(name)
      WHERE lower(n.name) = lower(v_name)
    ) THEN
      RAISE EXCEPTION 'Shift names must be unique'
        USING ERRCODE = 'check_violation';
    END IF;
    v_names := array_append(v_names, v_name);

    v_start_m := _admin_time_to_minutes((v_cur->>'start_time')::TIME);
    IF v_start_m = ANY (v_starts) THEN
      RAISE EXCEPTION 'Shift start times must be unique'
        USING ERRCODE = 'check_violation';
    END IF;
    v_starts := array_append(v_starts, v_start_m);
  END LOOP;

  FOR v_i IN 0 .. v_n - 1
  LOOP
    v_cur := v_active -> v_i;
    v_next := v_active -> ((v_i + 1) % v_n);
    v_end_m := _admin_time_to_minutes((v_cur->>'end_time')::TIME);
    -- endBefore(next.start) = next.start minutes - 1
    v_expected_end := (
      (_admin_time_to_minutes((v_next->>'start_time')::TIME) - 1 + 1440) % 1440
    );

    IF v_end_m <> v_expected_end THEN
      RAISE EXCEPTION
        'Shifts must cover the full day with no gaps or overlaps. "%" should end one minute before "%" starts',
        btrim(v_cur->>'name'),
        btrim(v_next->>'name')
        USING ERRCODE = 'check_violation';
    END IF;

    v_total := v_total + _admin_shift_duration_minutes(
      (v_cur->>'start_time')::TIME,
      (v_cur->>'end_time')::TIME
    );
  END LOOP;

  IF v_total <> 1440 THEN
    RAISE EXCEPTION 'Active shifts must cover exactly 24 hours (currently % minutes)', v_total
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

-- Grants are applied in the lockdown block at the end of this file.

-- ---------------------------------------------------------------------------
-- 1) Fuel types — same rules as onboarding / AuthService.saveFuelTypes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_save_fuel_types(
  p_pump_id UUID,
  p_fuel_types JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_item JSONB;
  v_name TEXT;
  v_rsp NUMERIC;
  v_ro NUMERIC;
  v_order INT;
  v_idx INT := 0;
  v_id UUID;
  v_result JSONB := '[]'::JSONB;
  v_names TEXT[] := ARRAY[]::TEXT[];
  v_count INT;
BEGIN
  PERFORM _admin_assert_pump_exists(p_pump_id);

  IF p_fuel_types IS NULL OR jsonb_typeof(p_fuel_types) <> 'array' THEN
    RAISE EXCEPTION 'fuel_types payload must be a JSON array'
      USING ERRCODE = 'check_violation';
  END IF;

  v_count := jsonb_array_length(p_fuel_types);
  IF v_count < 1 THEN
    RAISE EXCEPTION 'At least 1 fuel type is required'
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_count > 27 THEN
    RAISE EXCEPTION 'A maximum of 27 fuel types is allowed.'
      USING ERRCODE = 'check_violation';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_fuel_types)
  LOOP
    v_idx := v_idx + 1;
    v_name := btrim(COALESCE(v_item->>'name', ''));
    IF v_name = '' THEN
      RAISE EXCEPTION 'Fuel type name cannot be empty at index %', v_idx
        USING ERRCODE = 'check_violation';
    END IF;

    IF NOT _admin_is_allowed_fuel_type_name(v_name) THEN
      RAISE EXCEPTION 'Invalid fuel type "%". Use an allowed fuel type name from the app list.', v_name
        USING ERRCODE = 'check_violation';
    END IF;

    IF EXISTS (
      SELECT 1 FROM unnest(v_names) AS n(name)
      WHERE lower(n.name) = lower(v_name)
    ) THEN
      RAISE EXCEPTION 'Duplicate fuel type "%"', v_name
        USING ERRCODE = 'check_violation';
    END IF;
    v_names := array_append(v_names, v_name);

    v_rsp := (v_item->>'rsp')::NUMERIC;
    v_ro := (v_item->>'ro_price')::NUMERIC;
    IF v_rsp IS NULL OR v_ro IS NULL THEN
      RAISE EXCEPTION 'rsp and ro_price are required for "%"', v_name
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_rsp <= 0 THEN
      RAISE EXCEPTION 'Price is required / must be positive for "%"', v_name
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_ro < 0 THEN
      RAISE EXCEPTION 'Price cannot be negative for "%"', v_name
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_rsp > 200 OR v_ro > 200 THEN
      RAISE EXCEPTION 'Price is too high (maximum ₹200 per liter) for "%"', v_name
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_ro >= v_rsp THEN
      RAISE EXCEPTION 'Net Outlet Price must be < Standard Retail Price for "%"', v_name
        USING ERRCODE = 'check_violation';
    END IF;

    v_order := COALESCE((v_item->>'display_order')::INT, v_idx);

    SELECT id INTO v_id
    FROM fuel_types
    WHERE pump_id = p_pump_id
      AND LOWER(name) = LOWER(v_name)
    LIMIT 1;

    IF v_id IS NULL THEN
      INSERT INTO fuel_types (
        pump_id, name, rsp, ro_price, display_order, is_active
      ) VALUES (
        p_pump_id, v_name, v_rsp, v_ro, v_order, true
      )
      RETURNING id INTO v_id;
    ELSE
      UPDATE fuel_types
      SET
        name = v_name,
        rsp = v_rsp,
        ro_price = v_ro,
        display_order = v_order,
        is_active = true
      WHERE id = v_id
        AND pump_id = p_pump_id;
    END IF;

    v_result := v_result || jsonb_build_array(
      jsonb_build_object(
        'id', v_id,
        'name', v_name,
        'rsp', v_rsp,
        'ro_price', v_ro,
        'display_order', v_order
      )
    );
  END LOOP;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION admin_save_fuel_types(UUID, JSONB) IS
  'ADMIN PANEL ONLY (service_role). Not used by Flutter. Same rules as onboarding.';

-- ---------------------------------------------------------------------------
-- 2) Shifts — sync like sync_pump_shifts + ShiftCoverageValidator
--    Separate from public.sync_pump_shifts (dealer app keeps using that).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_sync_pump_shifts(
  p_pump_id UUID,
  p_shifts JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_item JSONB;
  v_id UUID;
  v_name TEXT;
  v_sequence SMALLINT;
  v_start TIME;
  v_end TIME;
  v_active BOOLEAN;
  v_result JSONB;
BEGIN
  PERFORM _admin_assert_pump_exists(p_pump_id);
  PERFORM _admin_validate_active_shifts(p_shifts);

  -- Pass 1: inactive rows
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_shifts) AS t(value)
    WHERE NOT COALESCE((value->>'is_active')::BOOLEAN, TRUE)
  LOOP
    v_name := btrim(COALESCE(v_item->>'name', ''));
    v_sequence := (v_item->>'sequence')::SMALLINT;
    v_start := (v_item->>'start_time')::TIME;
    v_end := (v_item->>'end_time')::TIME;
    v_active := FALSE;

    v_id := NULL;
    IF v_item ? 'id'
       AND NULLIF(btrim(COALESCE(v_item->>'id', '')), '') IS NOT NULL THEN
      v_id := (v_item->>'id')::UUID;
    END IF;

    IF v_id IS NULL THEN
      INSERT INTO shifts (
        pump_id, name, sequence, start_time, end_time, is_active
      ) VALUES (
        p_pump_id, v_name, v_sequence, v_start, v_end, v_active
      )
      RETURNING id INTO v_id;
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM shifts WHERE id = v_id AND pump_id = p_pump_id
      ) THEN
        RAISE EXCEPTION 'Shift not found for this pump'
          USING ERRCODE = 'check_violation';
      END IF;

      UPDATE shifts
      SET
        name = v_name,
        sequence = v_sequence,
        start_time = v_start,
        end_time = v_end,
        is_active = v_active
      WHERE id = v_id
        AND pump_id = p_pump_id;
    END IF;
  END LOOP;

  UPDATE shifts
  SET
    sequence = (10000 + sequence)::SMALLINT,
    name = '__sync__' || id::text
  WHERE pump_id = p_pump_id
    AND is_active = true;

  -- Pass 2: active rows
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_shifts) AS t(value)
    WHERE COALESCE((value->>'is_active')::BOOLEAN, TRUE)
  LOOP
    v_name := btrim(COALESCE(v_item->>'name', ''));
    v_sequence := (v_item->>'sequence')::SMALLINT;
    v_start := (v_item->>'start_time')::TIME;
    v_end := (v_item->>'end_time')::TIME;
    v_active := TRUE;

    v_id := NULL;
    IF v_item ? 'id'
       AND NULLIF(btrim(COALESCE(v_item->>'id', '')), '') IS NOT NULL THEN
      v_id := (v_item->>'id')::UUID;
    END IF;

    IF v_id IS NULL THEN
      INSERT INTO shifts (
        pump_id, name, sequence, start_time, end_time, is_active
      ) VALUES (
        p_pump_id, v_name, v_sequence, v_start, v_end, v_active
      )
      RETURNING id INTO v_id;
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM shifts WHERE id = v_id AND pump_id = p_pump_id
      ) THEN
        RAISE EXCEPTION 'Shift not found for this pump'
          USING ERRCODE = 'check_violation';
      END IF;

      UPDATE shifts
      SET
        name = v_name,
        sequence = v_sequence,
        start_time = v_start,
        end_time = v_end,
        is_active = v_active
      WHERE id = v_id
        AND pump_id = p_pump_id;
    END IF;
  END LOOP;

  -- Deactivate temp rows from the rename step (must not stay active)
  UPDATE shifts
  SET is_active = false
  WHERE pump_id = p_pump_id
    AND is_active = true
    AND name LIKE '\_\_sync\_\_%' ESCAPE '\';

  SELECT COALESCE(
    jsonb_agg(to_jsonb(s) ORDER BY s.sequence, s.name),
    '[]'::JSONB
  )
  INTO v_result
  FROM shifts s
  WHERE s.pump_id = p_pump_id
    AND s.is_active = true
    AND name NOT LIKE '\_\_sync\_\_%' ESCAPE '\';

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION admin_sync_pump_shifts(UUID, JSONB) IS
  'ADMIN PANEL ONLY (service_role). Does not replace sync_pump_shifts used by Flutter.';

-- ---------------------------------------------------------------------------
-- 3) Nozzles — same rules as AuthService.saveNozzles
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_save_nozzles(
  p_pump_id UUID,
  p_nozzles JSONB,
  p_meter_date DATE,
  p_shift_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_item JSONB;
  v_fuel_type_id UUID;
  v_fuel_name TEXT;
  v_initial NUMERIC;
  v_nozzle_id UUID;
  v_nozzle_number INT := 1;
  v_created JSONB := '[]'::JSONB;
  v_ft RECORD;
  v_count INT;
BEGIN
  PERFORM _admin_assert_pump_exists(p_pump_id);

  IF p_meter_date IS NULL THEN
    RAISE EXCEPTION 'Meter readings start date is required.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Mirror app: meter start date cannot be in the future
  IF p_meter_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Meter readings start date cannot be in the future.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_shift_id IS NULL THEN
    RAISE EXCEPTION 'Please select a shift for the initial meter readings.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM shifts
    WHERE id = p_shift_id
      AND pump_id = p_pump_id
  ) THEN
    RAISE EXCEPTION 'shift_id does not belong to this pump'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_nozzles IS NULL OR jsonb_typeof(p_nozzles) <> 'array' THEN
    RAISE EXCEPTION 'nozzles payload must be a JSON array'
      USING ERRCODE = 'check_violation';
  END IF;

  v_count := jsonb_array_length(p_nozzles);
  IF v_count < 1 THEN
    RAISE EXCEPTION 'At least one nozzle is required'
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_count > 25 THEN
    RAISE EXCEPTION 'A maximum of 25 nozzles is allowed.'
      USING ERRCODE = 'check_violation';
  END IF;

  DELETE FROM nozzle_reading WHERE pump_id = p_pump_id;
  DELETE FROM nozzle_info WHERE pump_id = p_pump_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_nozzles)
  LOOP
    v_fuel_type_id := NULL;
    IF NULLIF(btrim(COALESCE(v_item->>'fuel_type_id', '')), '') IS NOT NULL THEN
      v_fuel_type_id := (v_item->>'fuel_type_id')::UUID;
    END IF;

    v_fuel_name := NULLIF(btrim(COALESCE(v_item->>'fuel_type_name', '')), '');

    IF v_fuel_type_id IS NULL AND v_fuel_name IS NOT NULL THEN
      SELECT id, name INTO v_fuel_type_id, v_fuel_name
      FROM fuel_types
      WHERE pump_id = p_pump_id
        AND LOWER(name) = LOWER(v_fuel_name)
      LIMIT 1;
    END IF;

    IF v_fuel_type_id IS NULL THEN
      RAISE EXCEPTION 'fuel_type_id is required for all nozzles'
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT name INTO v_fuel_name
    FROM fuel_types
    WHERE id = v_fuel_type_id
      AND pump_id = p_pump_id;

    IF v_fuel_name IS NULL THEN
      RAISE EXCEPTION 'Fuel type name not found for fuel_type_id: %', v_fuel_type_id
        USING ERRCODE = 'check_violation';
    END IF;

    IF v_item ? 'initial_meter_reading'
       AND v_item->>'initial_meter_reading' IS NOT NULL THEN
      v_initial := (v_item->>'initial_meter_reading')::NUMERIC;
    ELSE
      RAISE EXCEPTION 'initial_meter_reading is required for all nozzles. Received: null'
        USING ERRCODE = 'check_violation';
    END IF;

    IF v_initial < 0 THEN
      RAISE EXCEPTION 'initial_meter_reading cannot be negative. Received: %', v_initial
        USING ERRCODE = 'check_violation';
    END IF;

    v_nozzle_id := gen_random_uuid();

    INSERT INTO nozzle_info (
      pump_id,
      nozzle_id,
      nozzle_number,
      fuel_type_id,
      fuel_type,
      initial_meter_reading,
      is_active
    ) VALUES (
      p_pump_id,
      v_nozzle_id,
      v_nozzle_number,
      v_fuel_type_id,
      v_fuel_name,
      v_initial,
      true
    );

    INSERT INTO nozzle_reading (
      pump_id,
      nozzle_id,
      fuel_type_id,
      opening_reading,
      closing_reading,
      date,
      shift_id
    ) VALUES (
      p_pump_id,
      v_nozzle_id,
      v_fuel_type_id,
      v_initial,
      v_initial,
      p_meter_date,
      p_shift_id
    );

    v_created := v_created || jsonb_build_array(
      jsonb_build_object(
        'nozzle_id', v_nozzle_id,
        'nozzle_number', v_nozzle_number,
        'fuel_type_id', v_fuel_type_id,
        'fuel_type', v_fuel_name,
        'initial_meter_reading', v_initial
      )
    );

    v_nozzle_number := v_nozzle_number + 1;
  END LOOP;

  -- Seed fuel_price_history like app onboarding
  IF NOT EXISTS (
    SELECT 1 FROM fuel_types WHERE pump_id = p_pump_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'No fuel types found to save fuel price history.'
      USING ERRCODE = 'check_violation';
  END IF;

  FOR v_ft IN
    SELECT id, rsp, ro_price
    FROM fuel_types
    WHERE pump_id = p_pump_id
      AND is_active = true
  LOOP
    IF v_ft.rsp IS NULL OR v_ft.ro_price IS NULL THEN
      RAISE EXCEPTION 'Fuel type prices are missing. Please try again.'
        USING ERRCODE = 'check_violation';
    END IF;

    INSERT INTO fuel_price_history (
      pump_id,
      fuel_type_id,
      effective_date,
      rsp,
      ro_price,
      source
    ) VALUES (
      p_pump_id,
      v_ft.id,
      p_meter_date,
      v_ft.rsp,
      v_ft.ro_price,
      'onboarding'
    )
    ON CONFLICT (fuel_type_id, effective_date) DO UPDATE
    SET
      rsp = EXCLUDED.rsp,
      ro_price = EXCLUDED.ro_price,
      source = 'onboarding',
      updated_at = NOW();
  END LOOP;

  RETURN v_created;
END;
$$;

COMMENT ON FUNCTION admin_save_nozzles(UUID, JSONB, DATE, UUID) IS
  'ADMIN PANEL ONLY (service_role). Not used by Flutter AuthService.saveNozzles.';

-- ---------------------------------------------------------------------------
-- 4) One-shot wrapper (no pump marker columns)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_complete_onboarding(
  p_pump_id UUID,
  p_fuel_types JSONB,
  p_shifts JSONB,
  p_nozzles JSONB,
  p_meter_date DATE,
  p_shift_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_fuels JSONB;
  v_shifts JSONB;
  v_nozzles JSONB;
  v_shift_id UUID;
  v_first_shift UUID;
BEGIN
  PERFORM _admin_assert_pump_exists(p_pump_id);

  v_fuels := admin_save_fuel_types(p_pump_id, p_fuel_types);
  v_shifts := admin_sync_pump_shifts(p_pump_id, p_shifts);

  v_shift_id := p_shift_id;
  IF v_shift_id IS NULL THEN
    SELECT id INTO v_first_shift
    FROM shifts
    WHERE pump_id = p_pump_id
      AND is_active = true
    ORDER BY sequence, name
    LIMIT 1;

    IF v_first_shift IS NULL THEN
      RAISE EXCEPTION 'Please select a shift for the initial meter readings.'
        USING ERRCODE = 'check_violation';
    END IF;
    v_shift_id := v_first_shift;
  END IF;

  v_nozzles := admin_save_nozzles(
    p_pump_id,
    p_nozzles,
    p_meter_date,
    v_shift_id
  );

  RETURN jsonb_build_object(
    'pump_id', p_pump_id,
    'fuel_types', v_fuels,
    'shifts', v_shifts,
    'nozzles', v_nozzles,
    'shift_id_used', v_shift_id,
    'meter_date', p_meter_date
  );
END;
$$;

COMMENT ON FUNCTION admin_complete_onboarding(UUID, JSONB, JSONB, JSONB, DATE, UUID) IS
  'ADMIN PANEL ONLY (service_role). One-shot onboarding; Flutter path unchanged.';

-- ============================================
-- Lockdown: service_role only — Flutter (authenticated/anon) cannot call
-- ============================================
-- Re-apply after CREATE OR REPLACE (Postgres may restore default PUBLIC execute).

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (
        p.proname LIKE 'admin\_%' ESCAPE '\'
        OR p.proname LIKE '\_admin\_%' ESCAPE '\'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END;
$$;
