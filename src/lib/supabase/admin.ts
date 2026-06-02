import { createClient as createSupabaseClient } from "@supabase/supabase-js"

import type { Database } from "./types"

/**
 * Server-only Supabase client using the SERVICE ROLE key.
 * This BYPASSES Row Level Security — never import it into client code,
 * and only use it for trusted server tasks (e.g. provisioning a new org).
 */
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set")
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
