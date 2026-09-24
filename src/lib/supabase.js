import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const hasSupabaseAuthConfig = Boolean(supabaseUrl && supabaseAnonKey)

/** Auth / session only — subject to RLS. Null when env is missing. */
export const supabase = hasSupabaseAuthConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export {
  db,
  supabaseAdmin,
  hasAdminServiceRole,
  requireAdminClient,
} from './adminSupabase'
