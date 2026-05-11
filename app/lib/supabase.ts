import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Check if Supabase is configured
const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Create a typed supabase client (or a mock client if not configured)
// Note: Types are inferred at query time, not at client creation
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : createMockClient();

// Create a mock client for when Supabase is not configured
function createMockClient(): SupabaseClient {
  console.warn('Supabase not configured - using mock client');
  // Create a minimal client that won't crash but won't work either
  // This allows the app to at least render
  return createClient('https://placeholder.supabase.co', 'placeholder-key', {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

// Helper to get the current user
export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

// Helper to get the current session
export async function getCurrentSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

// Data client — bypasses the auth lock entirely.
// Use this for all table queries inside hooks/components.
// The JWT is injected via global headers at creation time so the client never
// calls getSession() (and therefore never waits on the internal auth lock).
export function createDataClient(accessToken: string | null): SupabaseClient {
  if (!isSupabaseConfigured) return createMockClient();
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
}

// Server-side client (for API routes)
export function createServerClient(accessToken?: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    },
  });
}
