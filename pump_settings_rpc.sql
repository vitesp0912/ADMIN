-- ============================================
-- RPC Function: get_pump_operational_metrics
-- ============================================
-- This is the SINGLE SOURCE OF TRUTH for pump operational data
-- Used by the Settings page to display accurate metrics
-- 
-- Returns:
-- - Fuel types with RSP/RO pricing for the pump
-- - Count of nozzles configured
-- - Count of fuel types configured
-- ============================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_pump_operational_metrics(uuid);

CREATE OR REPLACE FUNCTION get_pump_operational_metrics(p_pump_id uuid)
RETURNS TABLE (
  pump_id uuid,
  pump_name text,
  pump_code text,
  fuel_types jsonb,
  fuel_type_count integer,
  nozzle_count integer,
  created_at timestamp with time zone
) AS $$
BEGIN
  -- Get fuel types with RSP/RO pricing
  -- Join nozzle_info to find fuel types used by this pump
  -- Sort by fuel type name for consistency
  RETURN QUERY
  WITH pump_info AS (
    SELECT id, name, pump_code, created_at
    FROM pumps
    WHERE id = p_pump_id
  ),
  fuel_data AS (
    SELECT 
      jsonb_agg(
        jsonb_build_object(
          'fuel_type_id', ft.id,
          'name', ft.name,
          'fuel_type', ft.fuel_type,
          'rsp', ft.rsp,
          'ro', ft.ro_price
        )
        ORDER BY ft.name ASC NULLS LAST
      ) as fuel_types,
      COUNT(DISTINCT ft.id) as fuel_type_count
    FROM fuel_types ft
    WHERE EXISTS (
      SELECT 1 FROM nozzle_info ni
      WHERE ni.pump_id = p_pump_id
        AND ni.fuel_type_id = ft.id
    )
  ),
  nozzle_data AS (
    SELECT COUNT(*) as nozzle_count
    FROM nozzle_info
    WHERE pump_id = p_pump_id
  )
  SELECT 
    pi.id,
    pi.name,
    pi.pump_code,
    COALESCE(fd.fuel_types, '[]'::jsonb),
    COALESCE(fd.fuel_type_count, 0),
    nd.nozzle_count,
    pi.created_at
  FROM pump_info pi
  CROSS JOIN fuel_data fd
  CROSS JOIN nozzle_data nd;
  
  -- Verify pump exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pump not found: %', p_pump_id;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- Test query
-- ============================================
-- SELECT * FROM get_pump_operational_metrics('<pump_id_here>');
-- Replace '<pump_id_here>' with an actual pump UUID from your database
