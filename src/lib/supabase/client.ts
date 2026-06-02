import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "./types"

/**
 * Browser-side Supabase client (Client Components).
 * Uses the public anon key; all access is constrained by RLS.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
