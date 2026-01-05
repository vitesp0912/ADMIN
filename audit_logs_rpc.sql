-- ============================================
-- RPC Function: get_audit_logs
-- ============================================
-- Fetches paginated audit logs for a pump
-- Returns user-friendly data, hides technical fields
-- Supports filtering by date range, action, entity, and actor
-- ============================================

DROP FUNCTION IF EXISTS get_audit_logs(uuid, integer, integer);
DROP FUNCTION IF EXISTS get_audit_logs(uuid, integer, integer, timestamp with time zone, timestamp with time zone, text, text, text);

CREATE OR REPLACE FUNCTION get_audit_logs(
  p_pump_id uuid,
  p_limit integer DEFAULT 10,
  p_offset integer DEFAULT 0,
  p_date_from timestamp with time zone DEFAULT NULL,
  p_date_to timestamp with time zone DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_actor_role text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  action text,
  action_label text,
  entity_type text,
  entity_label text,
  actor_name text,
  actor_role text,
  reason text,
  source text,
  created_at timestamp with time zone,
  ip_address text,
  user_agent text,
  has_changes boolean,
  old_values jsonb,
  new_values jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    al.id,
    al.action::text,
    -- Human-readable action label
    CASE al.action
      WHEN 'INSERT' THEN 'Created'
      WHEN 'UPDATE' THEN 'Updated'
      WHEN 'DELETE' THEN 'Deleted'
      WHEN 'CREATE' THEN 'Created'
      WHEN 'PRICE_SYNC' THEN 'Price Updated'
      WHEN 'PRICE_UPDATE' THEN 'Price Updated'
      WHEN 'LOGIN' THEN 'Logged In'
      WHEN 'LOGOUT' THEN 'Logged Out'
      WHEN 'PASSWORD_RESET' THEN 'Password Reset'
      WHEN 'SETTINGS_UPDATE' THEN 'Settings Changed'
      WHEN 'BULK_UPDATE' THEN 'Bulk Update'
      WHEN 'IMPORT' THEN 'Data Imported'
      WHEN 'EXPORT' THEN 'Data Exported'
      ELSE INITCAP(REPLACE(al.action, '_', ' '))
    END::text as action_label,
    al.entity_type::text,
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
      WHEN 'pump' THEN 'Pump Settings'
      WHEN 'pumps' THEN 'Pump Settings'
      WHEN 'pump_settings' THEN 'Pump Settings'
      WHEN 'user' THEN 'User'
      WHEN 'users' THEN 'User'
      WHEN 'staff' THEN 'Staff'
      WHEN 'credit_customer' THEN 'Credit Customer'
      WHEN 'credit_customers' THEN 'Credit Customer'
      WHEN 'credit_sale' THEN 'Credit Sale'
      WHEN 'credit_sales' THEN 'Credit Sale'
      WHEN 'tank' THEN 'Tank'
      WHEN 'tanks' THEN 'Tank'
      ELSE INITCAP(REPLACE(al.entity_type, '_', ' '))
    END::text as entity_label,
    -- Actor name: try to get from users table, fallback to role
    COALESCE(
      (SELECT u.name FROM users u WHERE u.id = al.actor_id LIMIT 1),
      CASE 
        WHEN al.actor_id IS NULL THEN 'System'
        WHEN al.actor_role = 'system' THEN 'System'
        WHEN al.actor_role = 'admin' THEN 'Admin'
        WHEN al.actor_role = 'manager' THEN 'Manager'
        WHEN al.actor_role = 'staff' THEN 'Staff'
        ELSE INITCAP(COALESCE(al.actor_role, 'Unknown'))
      END
    )::text as actor_name,
    COALESCE(al.actor_role, 'system')::text as actor_role,
    al.reason::text,
    COALESCE(al.source, 'system')::text as source,
    al.created_at,
    al.ip_address::text,
    al.user_agent::text,
    -- Check if there are actual changes to show
    (al.old_data IS NOT NULL OR al.new_data IS NOT NULL OR 
     al.old_values IS NOT NULL OR al.new_values IS NOT NULL) as has_changes,
    -- Prefer old_values/new_values, fallback to old_data/new_data
    COALESCE(al.old_values, al.old_data) as old_values,
    COALESCE(al.new_values, al.new_data) as new_values
  FROM audit_logs al
  WHERE al.pump_id = p_pump_id
    AND (p_date_from IS NULL OR al.created_at >= p_date_from)
    AND (p_date_to IS NULL OR al.created_at <= p_date_to)
    AND (p_action IS NULL OR al.action = p_action)
    AND (p_entity_type IS NULL OR al.entity_type = p_entity_type)
    AND (p_actor_role IS NULL OR al.actor_role = p_actor_role)
  ORDER BY al.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- RPC Function: get_audit_logs_count
-- ============================================
-- Returns total count for pagination info
-- Supports the same filters as get_audit_logs
-- ============================================

DROP FUNCTION IF EXISTS get_audit_logs_count(uuid);
DROP FUNCTION IF EXISTS get_audit_logs_count(uuid, timestamp with time zone, timestamp with time zone, text, text, text);

CREATE OR REPLACE FUNCTION get_audit_logs_count(
  p_pump_id uuid,
  p_date_from timestamp with time zone DEFAULT NULL,
  p_date_to timestamp with time zone DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_actor_role text DEFAULT NULL
)
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer 
    FROM audit_logs 
    WHERE pump_id = p_pump_id
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to IS NULL OR created_at <= p_date_to)
      AND (p_action IS NULL OR action = p_action)
      AND (p_entity_type IS NULL OR entity_type = p_entity_type)
      AND (p_actor_role IS NULL OR actor_role = p_actor_role)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- RPC Function: get_audit_filter_options
-- ============================================
-- Returns distinct values for filter dropdowns
-- Provides only options that exist in the data
-- ============================================

DROP FUNCTION IF EXISTS get_audit_filter_options(uuid);

CREATE OR REPLACE FUNCTION get_audit_filter_options(p_pump_id uuid)
RETURNS TABLE (
  actions text[],
  entity_types text[],
  actor_roles text[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT ARRAY_AGG(DISTINCT action ORDER BY action) FROM audit_logs WHERE pump_id = p_pump_id)::text[] as actions,
    (SELECT ARRAY_AGG(DISTINCT entity_type ORDER BY entity_type) FROM audit_logs WHERE pump_id = p_pump_id)::text[] as entity_types,
    (SELECT ARRAY_AGG(DISTINCT actor_role ORDER BY actor_role) FROM audit_logs WHERE pump_id = p_pump_id AND actor_role IS NOT NULL)::text[] as actor_roles;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
