import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://api.petrofi.in'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVidnp3YnVpZ2FhZXZrYmxtZ2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMDYzMTcsImV4cCI6MjA3ODU4MjMxN30.oyNZGs5-WYVsfycH8bdtOF9r3gRNRdrZtXmUI5RvPi0'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

