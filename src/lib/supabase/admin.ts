import { createClient as createJsClient } from '@supabase/supabase-js';

/**
 * Admin client with service_role key — bypasses RLS.
 * NEVER import this from client components.
 * Use only in: server actions, route handlers, cron jobs.
 */
export function createAdminClient() {
  return createJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}
