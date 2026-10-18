'use client';

// Compatibility shim - re-exports from Supabase auth
// This allows existing imports to work without modification

export { AuthProvider, useAuth } from './AuthContextSupabase';

// Re-export types for compatibility
export type { Profile as AuthUser } from '@/types/database';
