import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The Supabase client with the server key (service role), for the daily agenda load only
 * (`app/api/cron/agenda/route.ts`). It bypasses row-level security: never import it from browser code
 * (`__tests__/lib/supabaseAdminIsolado.test.ts` keeps it out of components/, hooks/, app/(hub)/ and lib/hub/).
 * The environment is read and the client built only when called, inside the handler, never at module load.
 *
 * Returns null when `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is unset.
 */
export function createServiceClient(): SupabaseClient | null {
  if (typeof window !== 'undefined') throw new Error('createServiceClient runs on the server only');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
