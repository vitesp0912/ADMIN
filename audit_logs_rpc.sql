-- ============================================
-- RPC Function: get_audit_logs
-- ============================================
-- Fetches paginated audit logs for a pump
-- Returns user-friendly data, hides technical fields
-- ============================================

DROP FUNCTION IF EXISTS get_audit_logs(uuid, integer, integer);

CREATE OR REPLACE FUNCTION get_audit_logs(
  p_pump_id uuid,
  p_limit integer DEFAULT 10,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  action_label text,
  entity_label text,
  actor_name text,
  actor_role text,
  reason text,
  created_at timestamp with time zone,
  ip_address text,
  has_changes boolean,
  old_values jsonb,
  new_values jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    al.id,
    -- Human-readable action label
    CASE al.action
      WHEN 'INSERT' THEN 'Created'
      WHEN 'UPDATE' THEN 'Updated'
      WHEN 'DELETE' THEN 'Deleted'
      WHEN 'CREATE' THEN 'Created'
      ELSE INITCAP(REPLACE(al.action, '_', ' '))
    END::text as action_label,
    -- Human-readable entity type
    CASE al.entity_type
      WHEN 'meter_reading' THEN 'Meter Reading'
      WHEN 'nozzle_reading' THEN 'Meter Reading'
      WHEN 'fuel_type' THEN 'Fuel Type'
      WHEN 'fuel_types' THEN 'Fuel Type'
      WHEN 'expense' THEN 'Expense'
      WHEN 'expenses' THEN 'Expense'
      WHEN 'sale' THEN 'Sale'
      WHEN 'sales' THEN 'Sale'
      WHEN 'dip_entry' THEN 'Dip Entry'
      WHEN 'dip_entries' THEN 'Dip Entry'
      WHEN 'salary_entry' THEN 'Salary Entry'
      WHEN 'salary_entries' THEN 'Salary Entry'
      WHEN 'daily_testing' THEN 'Daily Testing'
      WHEN 'nozzle' THEN 'Nozzle'
      WHEN 'nozzle_info' THEN 'Nozzle'
      WHEN 'pump' THEN 'Pump'
      WHEN 'pumps' THEN 'Pump'
      WHEN 'user' THEN 'User'
      WHEN 'users' THEN 'User'
      ELSE INITCAP(REPLACE(al.entity_type, '_', ' '))
    END::text as entity_label,
    -- Actor name: try to get from users table, fallback to role
    COALESCE(
      (SELECT u.name FROM users u WHERE u.id = al.actor_id LIMIT 1),
      CASE 
        WHEN al.actor_id IS NULL THEN 'System'
        WHEN al.actor_role = 'system' THEN 'System'
        ELSE INITCAP(al.actor_role)
      END
    )::text as actor_name,
    al.actor_role::text,
    al.reason::text,
    al.created_at,
    al.ip_address::text,
    -- Check if there are actual changes to show
    (al.old_data IS NOT NULL OR al.new_data IS NOT NULL OR 
     al.old_values IS NOT NULL OR al.new_values IS NOT NULL) as has_changes,
    -- Prefer old_values/new_values, fallback to old_data/new_data
    COALESCE(al.old_values, al.old_data) as old_values,
    COALESCE(al.new_values, al.new_data) as new_values
  FROM audit_logs al
  WHERE al.pump_id = p_pump_id
  ORDER BY al.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- RPC Function: get_audit_logs_count
-- ============================================
-- Returns total count for pagination info
-- ============================================

DROP FUNCTION IF EXISTS get_audit_logs_count(uuid);

CREATE OR REPLACE FUNCTION get_audit_logs_count(p_pump_id uuid)
RETURNS integer AS $$
BEGIN
  RETURN (SELECT COUNT(*)::integer FROM audit_logs WHERE pump_id = p_pump_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
