'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  clearError: () => void;
  // Aliases for compatibility with old auth context
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, displayName?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  loginWithApple: () => Promise<{ success: boolean; error?: string }>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Check if Supabase is properly configured
const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  // Fetch user profile
  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  };

  useEffect(() => {
    // Failsafe timeout - don't let loading hang forever
    const failsafeTimeout = setTimeout(() => {
      setLoading(false);
    }, 3000);

    // Skip Supabase initialization if not configured
    if (!isSupabaseConfigured) {
      console.warn('Supabase not configured - skipping auth initialization');
      setLoading(false);
      clearTimeout(failsafeTimeout);
      return;
    }

    // Get initial session
    const initializeAuth = async () => {
      try {
        const {
          data: { session: initialSession },
          error: sessionError,
        } = await supabase.auth.getSession();

        // If there's an error (e.g., Supabase not configured), just set loading to false
        if (sessionError) {
          console.warn('Auth session error (Supabase may not be configured):', sessionError.message);
          setLoading(false);
          return;
        }

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          const userProfile = await fetchProfile(initialSession.user.id);
          setProfile(userProfile);
        }
      } catch (error) {
        console.warn('Error initializing auth (Supabase may not be configured):', error);
      } finally {
        setLoading(false);
        clearTimeout(failsafeTimeout);
      }
    };

    initializeAuth();

    // Listen for auth changes
    let subscription: { unsubscribe: () => void } | null = null;

    try {
      const result = supabase.auth.onAuthStateChange(async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          let userProfile = await fetchProfile(newSession.user.id);

          // Create profile if it doesn't exist (e.g., after OAuth sign-in)
          if (!userProfile && newSession.user.email) {
            await createProfileIfNotExists(
              newSession.user.id,
              newSession.user.email,
              newSession.user.user_metadata?.full_name as string | undefined
            );
            userProfile = await fetchProfile(newSession.user.id);
          }

          setProfile(userProfile);
        } else {
          setProfile(null);
        }

        setLoading(false);
      });
      subscription = result.data.subscription;
    } catch (error) {
      console.warn('Error setting up auth listener:', error);
    }

    return () => {
      clearTimeout(failsafeTimeout);
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: displayName,
        },
      },
    });

    // If signup successful, create the profile manually
    if (!error && data.user) {
      await createProfileIfNotExists(data.user.id, email, displayName);
    }

    return { error };
  };

  // Helper to create profile if it doesn't exist
  const createProfileIfNotExists = async (userId: string, email: string, displayName?: string) => {
    try {
      // Check if profile exists
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (!existing) {
        // Create profile
        await supabase.from('profiles').insert({
          id: userId,
          email: email,
          display_name: displayName || email.split('@')[0],
        });

        // Seed default watchlist
        await supabase.from('watchlist_items').insert([
          { user_id: userId, symbol: 'ES', asset_type: 'futures', display_name: 'S&P 500 E-mini', is_primary: true, sort_order: 1 },
          { user_id: userId, symbol: 'NQ', asset_type: 'futures', display_name: 'NASDAQ-100 E-mini', is_primary: true, sort_order: 2 },
          { user_id: userId, symbol: 'BTC', asset_type: 'crypto', display_name: 'Bitcoin', is_primary: true, sort_order: 3 },
          { user_id: userId, symbol: 'ETH', asset_type: 'crypto', display_name: 'Ethereum', is_primary: true, sort_order: 4 },
          { user_id: userId, symbol: 'SOL', asset_type: 'crypto', display_name: 'Solana', is_primary: false, sort_order: 5 },
        ]);
      }
    } catch (err) {
      console.error('Error creating profile:', err);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { error };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    return { error };
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) {
      return { error: new Error('Not authenticated') };
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (!error) {
      // Refresh profile
      const updatedProfile = await fetchProfile(user.id);
      setProfile(updatedProfile);
    }

    return { error: error ? new Error(error.message) : null };
  };

  // Compatibility wrappers for old auth context interface
  const login = async (email: string, password: string) => {
    const { error } = await signIn(email, password);
    if (error) {
      setError(error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  const register = async (email: string, password: string, displayName?: string) => {
    const { error } = await signUp(email, password, displayName);
    if (error) {
      setError(error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  const logout = signOut;

  const loginWithGoogle = async () => {
    const { error } = await signInWithGoogle();
    if (error) {
      setError(error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  const loginWithApple = async () => {
    // Apple login not yet configured
    console.warn('Apple login not yet implemented');
    return { success: false, error: 'Apple login not available' };
  };

  const sendPasswordReset = async (email: string) => {
    const { error } = await resetPassword(email);
    if (error) {
      setError(error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  const value: AuthContextType = {
    user,
    profile,
    session,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    resetPassword,
    updateProfile,
    clearError,
    // Compatibility aliases
    login,
    register,
    logout,
    loginWithGoogle,
    loginWithApple,
    sendPasswordReset,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
