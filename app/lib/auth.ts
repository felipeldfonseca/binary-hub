// Compatibility shim for lean rebuild
// Old Firebase auth functions are replaced by Supabase

import { supabase } from './supabase';

// Types (kept for compatibility)
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: Date;
  updatedAt: Date;
  username?: string;
  bio?: string;
  location?: string;
  website?: string;
  tradingSince?: string;
  socialStats?: {
    followersCount: number;
    followingCount: number;
    postsCount: number;
    likesReceived: number;
  };
  privacy?: {
    allowsFollows: boolean;
    requiresFollowApproval: boolean;
    showsOnlineStatus: boolean;
    allowsDirectMessages: boolean;
  };
  socialPreferences?: {
    defaultPostVisibility: 'public' | 'followers' | 'private';
    autoShareTrades: boolean;
    notifyOnMentions: boolean;
    notifyOnFollows: boolean;
  };
}

export interface Achievement {
  id: string;
  type: 'streak' | 'profit' | 'trades' | 'winrate' | 'consistency' | 'milestone';
  title: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  earnedAt: Date;
}

export interface PublicProfile {
  id: string;
  displayName: string;
  username?: string;
  bio?: string;
  photoURL: string;
  location?: string;
  website?: string;
  tradingSince?: string;
  stats?: {
    totalTrades: number;
    winRate: number;
    totalProfit: number;
    avgStake: number;
    currentStreak: number;
    bestStreak: number;
    profitableDays: number;
  };
  socialStats: {
    followersCount: number;
    followingCount: number;
    postsCount: number;
    likesReceived: number;
  };
  relationship?: {
    isFollowing: boolean;
    isFollower: boolean;
    isBlocked: boolean;
    isMuted: boolean;
  };
  recentAchievements: Achievement[];
}

// Format user helper
export const formatUser = (user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
} | null): AuthUser | null => {
  if (!user) return null;
  return {
    uid: user.id,
    email: user.email || null,
    displayName: (user.user_metadata?.full_name as string) || null,
    photoURL: (user.user_metadata?.avatar_url as string) || null,
  };
};

// Create user profile in database
export const createUserProfile = async (user: AuthUser): Promise<void> => {
  const { error } = await supabase.from('profiles').upsert({
    id: user.uid,
    email: user.email || '',
    display_name: user.displayName,
    avatar_url: user.photoURL,
  });
  if (error) console.error('Error creating profile:', error);
};

// Auth functions
export const registerWithEmail = async (
  email: string,
  password: string,
  displayName?: string
) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: displayName },
      },
    });
    if (error) throw error;
    const user = data.user
      ? formatUser({
          id: data.user.id,
          email: data.user.email,
          user_metadata: data.user.user_metadata,
        })
      : null;
    return { user, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { user: null, error: message };
  }
};

export const loginWithEmail = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    const user = data.user
      ? formatUser({
          id: data.user.id,
          email: data.user.email,
          user_metadata: data.user.user_metadata,
        })
      : null;
    return { user, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { user: null, error: message };
  }
};

export const signInWithGoogle = async () => {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
    return { user: null, error: null }; // User will be set after redirect
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { user: null, error: message };
  }
};

export const signInWithApple = async () => {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
    return { user: null, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { user: null, error: message };
  }
};

export const logout = async () => {
  try {
    await supabase.auth.signOut();
    return { error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { error: message };
  }
};

export const resetPassword = async (email: string) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) throw error;
    return { error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { error: message };
  }
};

// Username utilities
export const createUniqueUsername = async (displayName: string): Promise<string> => {
  const baseUsername = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 15);

  let username = baseUsername;
  let counter = 1;

  while (await usernameExists(username)) {
    username = `${baseUsername}${counter}`;
    counter++;
  }

  return username;
};

export const usernameExists = async (username: string): Promise<boolean> => {
  // For now, just return false - username system to be implemented
  return false;
};

export const updateUsername = async (
  uid: string,
  newUsername: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (newUsername.length < 3 || newUsername.length > 20) {
      return { success: false, error: 'Username must be between 3 and 20 characters' };
    }

    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      return { success: false, error: 'Username can only contain letters, numbers, and underscores' };
    }

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: newUsername })
      .eq('id', uid);

    if (error) throw error;
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
};

export const getUserByUsername = async (username: string): Promise<PublicProfile | null> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('display_name', username)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      displayName: data.display_name || '',
      photoURL: data.avatar_url || '',
      socialStats: {
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        likesReceived: 0,
      },
      recentAchievements: [],
    };
  } catch {
    return null;
  }
};
