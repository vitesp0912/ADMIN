import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''

/**
 * Admin onboarding RPCs (admin_save_fuel_types, admin_sync_pump_shifts,
 * admin_save_nozzles) are EXECUTE-granted to service_role only.
 * Set VITE_SUPABASE_SERVICE_ROLE_KEY in .env / host env vars.
 */
export const hasAdminServiceRole = Boolean(supabaseUrl && serviceRoleKey)

export const supabaseAdmin = hasAdminServiceRole
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null

export function requireAdminClient() {
  if (!supabaseAdmin) {
    throw new Error(
      'Admin onboarding RPCs require VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY in your environment.'
    )
  }
  return supabaseAdmin
}
