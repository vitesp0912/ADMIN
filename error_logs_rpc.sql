-- ============================================
-- RPC Function: get_error_logs
-- ============================================
-- Fetches paginated error logs across all pumps
-- Returns user-friendly data for admin viewing
-- ============================================

DROP FUNCTION IF EXISTS get_error_logs(integer, integer);
DROP FUNCTION IF EXISTS get_error_logs(integer, integer, text, text, boolean);

CREATE OR REPLACE FUNCTION get_error_logs(
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_error_type text DEFAULT NULL,
  p_screen_name text DEFAULT NULL,
  p_show_resolved boolean DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  user_name text,
  phone text,
  pump_id uuid,
  pump_name text,
  pump_code text,
  error_type text,
  error_type_label text,
  error_code text,
  error_message text,
  error_stack text,
  screen_name text,
  screen_label text,
  action_attempted text,
  input_data jsonb,
  app_version text,
  device_info jsonb,
  created_at timestamp with time zone,
  resolved_at timestamp with time zone,
  resolved_by uuid,
  resolved_by_name text,
  is_resolved boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ea.id,
    ea.user_id,
    -- Get user name: try users table first, then fallback to phone
    COALESCE(
      (SELECT u.name FROM users u WHERE u.id = ea.user_id LIMIT 1),
      (SELECT au.raw_user_meta_data->>'name' FROM auth.users au WHERE au.id = ea.user_id LIMIT 1),
      (SELECT au.raw_user_meta_data->>'full_name' FROM auth.users au WHERE au.id = ea.user_id LIMIT 1),
      ea.phone,
      'Unknown User'
    )::text as user_name,
    ea.phone,
    ea.pump_id,
    -- Get pump name: try pump_name field first, then lookup from pumps table
    COALESCE(
      ea.pump_name,
      (SELECT p.name FROM pumps p WHERE p.id = ea.pump_id LIMIT 1),
      'Unknown Pump'
    )::text as pump_name,
    -- Get pump code: try pumps table, fallback to NULL
    (SELECT p.pump_code FROM pumps p WHERE p.id = ea.pump_id LIMIT 1)::text as pump_code,
    ea.error_type,
    -- Human-readable error type
    CASE ea.error_type
      WHEN 'NETWORK_ERROR' THEN 'Network Error'
      WHEN 'AUTH_ERROR' THEN 'Authentication Error'
      WHEN 'VALIDATION_ERROR' THEN 'Validation Error'
      WHEN 'DATABASE_ERROR' THEN 'Database Error'
      WHEN 'API_ERROR' THEN 'API Error'
      WHEN 'PERMISSION_ERROR' THEN 'Permission Denied'
      WHEN 'NOT_FOUND' THEN 'Not Found'
      WHEN 'TIMEOUT' THEN 'Timeout'
      WHEN 'SYNC_ERROR' THEN 'Sync Error'
      WHEN 'PAYMENT_ERROR' THEN 'Payment Error'
      WHEN 'UPLOAD_ERROR' THEN 'Upload Error'
      WHEN 'UNKNOWN' THEN 'Unknown Error'
      ELSE INITCAP(REPLACE(ea.error_type, '_', ' '))
    END::text as error_type_label,
    ea.error_code,
    ea.error_message,
    ea.error_stack,
    ea.screen_name,
    -- Human-readable screen name
    CASE ea.screen_name
      WHEN 'meter_reading' THEN 'Meter Reading'
      WHEN 'MeterReading' THEN 'Meter Reading'
      WHEN 'sales' THEN 'Sales'
      WHEN 'Sales' THEN 'Sales'
      WHEN 'expenses' THEN 'Expenses'
      WHEN 'Expenses' THEN 'Expenses'
      WHEN 'dip_entry' THEN 'Dip Entry'
      WHEN 'DipEntry' THEN 'Dip Entry'
      WHEN 'salary' THEN 'Salary'
      WHEN 'Salary' THEN 'Salary'
      WHEN 'login' THEN 'Login'
      WHEN 'Login' THEN 'Login'
      WHEN 'settings' THEN 'Settings'
      WHEN 'Settings' THEN 'Settings'
      WHEN 'dashboard' THEN 'Dashboard'
      WHEN 'Dashboard' THEN 'Dashboard'
      WHEN 'reports' THEN 'Reports'
      WHEN 'Reports' THEN 'Reports'
      ELSE COALESCE(INITCAP(REPLACE(ea.screen_name, '_', ' ')), 'Unknown')
    END::text as screen_label,
    ea.action_attempted,
    ea.input_data,
    ea.app_version,
    ea.device_info,
    ea.created_at,
    ea.resolved_at,
    ea.resolved_by,
    -- Get resolver name
    COALESCE(
      (SELECT u.name FROM users u WHERE u.id = ea.resolved_by LIMIT 1),
      NULL
    )::text as resolved_by_name,
    (ea.resolved_at IS NOT NULL) as is_resolved
  FROM error_audits ea
  WHERE 
    (p_error_type IS NULL OR ea.error_type = p_error_type)
    AND (p_screen_name IS NULL OR ea.screen_name = p_screen_name)
    AND (
      p_show_resolved IS NULL 
      OR (p_show_resolved = true AND ea.resolved_at IS NOT NULL)
      OR (p_show_resolved = false AND ea.resolved_at IS NULL)
    )
  ORDER BY ea.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- RPC Function: get_error_logs_count
-- ============================================
-- Returns total count for pagination info
-- ============================================

DROP FUNCTION IF EXISTS get_error_logs_count();
DROP FUNCTION IF EXISTS get_error_logs_count(text, text, boolean);

CREATE OR REPLACE FUNCTION get_error_logs_count(
  p_error_type text DEFAULT NULL,
  p_screen_name text DEFAULT NULL,
  p_show_resolved boolean DEFAULT NULL
)
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer 
    FROM error_audits
    WHERE 
      (p_error_type IS NULL OR error_type = p_error_type)
      AND (p_screen_name IS NULL OR screen_name = p_screen_name)
      AND (
        p_show_resolved IS NULL 
        OR (p_show_resolved = true AND resolved_at IS NOT NULL)
        OR (p_show_resolved = false AND resolved_at IS NULL)
      )
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- RPC Function: get_error_filter_options
-- ============================================
-- Returns distinct values for filter dropdowns
-- ============================================

DROP FUNCTION IF EXISTS get_error_filter_options();

CREATE OR REPLACE FUNCTION get_error_filter_options()
RETURNS TABLE (
  error_types text[],
  screen_names text[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT ARRAY_AGG(DISTINCT error_type ORDER BY error_type) FROM error_audits WHERE error_type IS NOT NULL)::text[] as error_types,
    (SELECT ARRAY_AGG(DISTINCT screen_name ORDER BY screen_name) FROM error_audits WHERE screen_name IS NOT NULL)::text[] as screen_names;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- RPC Function: resolve_error_log
-- ============================================
-- Marks an error as resolved
-- ============================================

DROP FUNCTION IF EXISTS resolve_error_log(uuid, uuid);

CREATE OR REPLACE FUNCTION resolve_error_log(
  p_error_id uuid,
  p_resolved_by uuid
)
RETURNS boolean AS $$
BEGIN
  UPDATE error_audits
  SET 
    resolved_at = NOW(),
    resolved_by = p_resolved_by
  WHERE id = p_error_id
    AND resolved_at IS NULL;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
