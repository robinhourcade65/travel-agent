import { createClient } from '@supabase/supabase-js'

/**
 * WARNING: This client uses the service_role key and bypasses Row-Level Security.
 * Never expose it to the browser. Use only in trusted server-side code
 * (Route Handlers, Server Actions, scripts).
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
