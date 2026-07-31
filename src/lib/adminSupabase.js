import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://ebvzwbuigaaevkblmgcs.supabase.co'

/**
 * Admin onboarding RPCs (admin_save_fuel_types, admin_sync_pump_shifts,
 * admin_save_nozzles) are EXECUTE-granted to service_role only.
 * Set VITE_SUPABASE_SERVICE_ROLE_KEY in local .env for this admin panel.
 * Never commit the key; never ship it in a public client build.
 */
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''

export const hasAdminServiceRole = Boolean(serviceRoleKey)

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
      'Admin onboarding RPCs require VITE_SUPABASE_SERVICE_ROLE_KEY in your .env (service_role only).'
    )
  }
  return supabaseAdmin
}
