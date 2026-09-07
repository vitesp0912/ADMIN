import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''

/**
 * Admin panel data client (service_role) — bypasses RLS.
 * Required after dealer-scoped RLS: petrofi admins are not pump members.
 *
 * Auth/login must still use the anon client in supabase.js.
 *
 * Set VITE_SUPABASE_SERVICE_ROLE_KEY in Vercel / host env (or CI secrets).
 * Do not commit it to .env in git. This admin bundle is trusted-operator only.
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

/** Prefer this name for CRUD / RPC from admin pages */
export const db = supabaseAdmin

export function requireAdminClient() {
  if (!supabaseAdmin) {
    throw new Error(
      'Admin data access requires VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY in your environment.'
    )
  }
  return supabaseAdmin
}
