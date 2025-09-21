# Binary Hub – Sprint 1-2 Implementation Guide

*Extending Foundation & Adding Social Authentication • Weeks 1-4 • January 2025*

---

## Overview

This guide details how to extend Binary Hub's existing advanced infrastructure to add social platform capabilities. We'll build upon your current Next.js 14 frontend, Firebase Functions backend, and established authentication system to prepare for social features.

**Current State Analysis:**
- ✅ Next.js 14 with TypeScript and Tailwind CSS
- ✅ Firebase Functions v2 with Express.js API
- ✅ Firebase Auth, Firestore, Storage configured
- ✅ Working emulator setup (ports: auth:9089, functions:5004, firestore:8889, storage:9189)
- ✅ Basic authentication and trading journal functionality
- ✅ Component structure in `/app/components/`
- ✅ API routes in `/functions/src/routes/`

**Sprint 1-2 Goals:**
- Extend user profiles for social features
- Add social authentication options
- Enhance UI components for social platform
- Prepare database schema for social data
- Add social-ready API endpoints

## Table of Contents

1. [Sprint 1: Social Foundation Extensions](#1-sprint-1-social-foundation-extensions)
2. [Sprint 2: Enhanced User Management & Social Prep](#2-sprint-2-enhanced-user-management--social-prep)
3. [Database Schema Extensions](#3-database-schema-extensions)
4. [API Enhancements](#4-api-enhancements)
5. [Frontend Extensions](#5-frontend-extensions)
6. [Testing Additions](#6-testing-additions)

---

## 1. Sprint 1: Social Foundation Extensions

### 1.1 Extend User Profile Schema

**Current:** Basic user profiles in Firestore
**Enhancement:** Add social platform fields

```typescript
// app/types/auth.ts - EXTEND existing UserProfile interface
export interface UserProfile {
  // ... existing fields remain unchanged ...
  
  // NEW SOCIAL FIELDS TO ADD:
  username?: string; // unique username for @mentions and URLs
  bio?: string; // short bio for profile
  location?: string; // user location
  website?: string; // personal website URL
  tradingSince?: string; // when they started trading
  
  // Social stats (calculated fields)
  socialStats?: {
    followersCount: number;
    followingCount: number;
    postsCount: number;
    likesReceived: number;
  };
  
  // Enhanced privacy controls for social features
  privacy: {
    // ... existing privacy fields ...
    
    // NEW SOCIAL PRIVACY FIELDS:
    allowsFollows: boolean; // can users follow this profile
    requiresFollowApproval: boolean; // manual approval for follows
    showsOnlineStatus: boolean; // show when user is online
    allowsDirectMessages: boolean; // can receive DMs
  };
  
  // Social preferences
  socialPreferences?: {
    defaultPostVisibility: 'public' | 'followers' | 'private';
    autoShareTrades: boolean; // automatically share good trades
    notifyOnMentions: boolean;
    notifyOnFollows: boolean;
  };
}

// NEW: Public profile interface for social features
export interface PublicProfile {
  id: string;
  displayName: string;
  username?: string;
  bio?: string;
  photoURL: string;
  location?: string;
  website?: string;
  tradingSince?: string;
  
  // Trading performance (if public)
  stats?: {
    totalTrades: number;
    winRate: number;
    currentStreak: number;
    bestStreak: number;
    profitableDays: number;
    // PnL hidden for privacy
  };
  
  // Social stats
  socialStats: {
    followersCount: number;
    followingCount: number;
    postsCount: number;
  };
  
  // Current user's relationship to this profile
  relationship?: {
    isFollowing: boolean;
    isFollower: boolean;
    isBlocked: boolean;
    isMuted: boolean;
  };
  
  // Recent achievements
  recentAchievements: Achievement[];
}
```

### 1.2 Enhance Authentication System

**Current:** Email/password authentication
**Enhancement:** Add social login options and username system

```typescript
// app/lib/auth/AuthContext.tsx - EXTEND existing context

// ADD these new functions to your existing AuthContext:

const createUniqueUsername = async (displayName: string): Promise<string> => {
  const baseUsername = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 15);
  
  let username = baseUsername;
  let counter = 1;
  
  // Check if username exists
  while (await usernameExists(username)) {
    username = `${baseUsername}${counter}`;
    counter++;
  }
  
  return username;
};

const usernameExists = async (username: string): Promise<boolean> => {
  const usernamesRef = collection(db, 'usernames');
  const q = query(usernamesRef, where('username', '==', username));
  const snapshot = await getDocs(q);
  return !snapshot.empty;
};

const updateUsername = async (newUsername: string): Promise<void> => {
  if (!user || !userProfile) {
    throw new Error('No authenticated user');
  }

  // Validate username
  if (newUsername.length < 3 || newUsername.length > 20) {
    throw new Error('Username must be between 3 and 20 characters');
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
    throw new Error('Username can only contain letters, numbers, and underscores');
  }

  // Check if username is available
  if (await usernameExists(newUsername)) {
    throw new Error('Username is already taken');
  }

  try {
    // Update in batch to ensure consistency
    const batch = writeBatch(db);
    
    // Update user profile
    const userDocRef = doc(db, 'users', user.uid);
    batch.update(userDocRef, {
      username: newUsername,
      updatedAt: serverTimestamp()
    });
    
    // Add to usernames collection for uniqueness checking
    const usernameDocRef = doc(db, 'usernames', newUsername);
    batch.set(usernameDocRef, {
      uid: user.uid,
      username: newUsername,
      createdAt: serverTimestamp()
    });
    
    // Remove old username if it exists
    if (userProfile.username) {
      const oldUsernameDocRef = doc(db, 'usernames', userProfile.username);
      batch.delete(oldUsernameDocRef);
    }
    
    await batch.commit();
    
    setUserProfile(prev => prev ? { ...prev, username: newUsername } : null);
  } catch (error) {
    throw new Error('Failed to update username');
  }
};

// EXTEND your existing signUp function to include username creation:
const signUp = async (data: CreateUserData) => {
  try {
    setError(null);
    setLoading(true);
    
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      data.email, 
      data.password
    );
    
    await updateProfile(userCredential.user, {
      displayName: data.displayName
    });
    
    // NEW: Create unique username
    const username = await createUniqueUsername(data.displayName);
    
    // Enhanced initial profile with social fields
    const initialProfile: UserProfile = {
      // ... existing fields ...
      
      // NEW SOCIAL FIELDS:
      username,
      bio: '',
      location: '',
      website: '',
      tradingSince: new Date().toISOString(),
      
      socialStats: {
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        likesReceived: 0
      },
      
      privacy: {
        // ... existing privacy settings ...
        allowsFollows: true,
        requiresFollowApproval: false,
        showsOnlineStatus: true,
        allowsDirectMessages: true
      },
      
      socialPreferences: {
        defaultPostVisibility: 'followers',
        autoShareTrades: false,
        notifyOnMentions: true,
        notifyOnFollows: true
      }
    };
    
    // Save user profile and username in batch
    const batch = writeBatch(db);
    
    const userDocRef = doc(db, 'users', userCredential.user.uid);
    batch.set(userDocRef, {
      ...initialProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    const usernameDocRef = doc(db, 'usernames', username);
    batch.set(usernameDocRef, {
      uid: userCredential.user.uid,
      username,
      createdAt: serverTimestamp()
    });
    
    await batch.commit();
    
    await sendEmailVerification(userCredential.user);
    
  } catch (error: any) {
    setError(getAuthErrorMessage(error.code));
    throw error;
  } finally {
    setLoading(false);
  }
};
```

### 1.3 Extend UI Component Library

**Current:** Basic UI components
**Enhancement:** Add social-ready components

```typescript
// app/components/ui/Avatar.tsx - NEW COMPONENT
import React from 'react';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AvatarProps {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showOnlineIndicator?: boolean;
  isOnline?: boolean;
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16'
};

const iconSizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8'
};

export function Avatar({ 
  src, 
  alt, 
  size = 'md', 
  className,
  showOnlineIndicator = false,
  isOnline = false
}: AvatarProps) {
  return (
    <div className={cn('relative', className)}>
      <div className={cn(
        'rounded-full overflow-hidden bg-gray-100 flex items-center justify-center',
        sizeClasses[size]
      )}>
        {src ? (
          <img
            src={src}
            alt={alt || 'Avatar'}
            className="h-full w-full object-cover"
          />
        ) : (
          <User className={cn('text-gray-400', iconSizeClasses[size])} />
        )}
      </div>
      
      {showOnlineIndicator && (
        <div className={cn(
          'absolute bottom-0 right-0 rounded-full border-2 border-white',
          isOnline ? 'bg-green-500' : 'bg-gray-400',
          size === 'sm' ? 'h-2 w-2' : 'h-3 w-3'
        )} />
      )}
    </div>
  );
}
```

```typescript
// app/components/ui/Badge.tsx - NEW COMPONENT
import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
        success: 'border-transparent bg-green-100 text-green-800',
        warning: 'border-transparent bg-yellow-100 text-yellow-800',
        info: 'border-transparent bg-blue-100 text-blue-800',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
```

### 1.4 Database Schema Preparation

**Current:** User and trades collections
**Enhancement:** Add social collections structure

```javascript
// firestore.rules - EXTEND your existing rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ... existing rules remain ...
    
    // NEW: Usernames collection for uniqueness
    match /usernames/{username} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && 
        request.auth.uid == resource.data.uid;
      allow delete: if request.auth != null && 
        request.auth.uid == resource.data.uid;
    }
    
    // NEW: Public profiles collection
    match /profiles/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // NEW: Social relationships
    match /users/{userId}/following/{followedUserId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /users/{userId}/followers/{followerUserId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == followerUserId;
    }
    
    // NEW: Posts collection (prepare for Sprint 3-4)
    match /posts/{postId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && 
        request.auth.uid == request.resource.data.authorId;
      allow update, delete: if request.auth != null && 
        request.auth.uid == resource.data.authorId;
    }
  }
}
```

## 2. Sprint 2: Enhanced User Management & Social Prep

### 2.1 Profile Management Components

**Current:** Basic profile editing
**Enhancement:** Social profile with username, bio, etc.

```typescript
// app/components/profile/ProfileSetupWizard.tsx - NEW COMPONENT
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/lib/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';

const profileSetupSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be less than 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  bio: z.string().max(160, 'Bio must be less than 160 characters').optional(),
  location: z.string().max(50, 'Location must be less than 50 characters').optional(),
  website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  tradingSince: z.string().optional(),
});

type ProfileSetupData = z.infer<typeof profileSetupSchema>;

interface ProfileSetupWizardProps {
  onComplete: () => void;
}

export function ProfileSetupWizard({ onComplete }: ProfileSetupWizardProps) {
  const { userProfile, updateUserProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ProfileSetupData>({
    resolver: zodResolver(profileSetupSchema),
    defaultValues: {
      username: userProfile?.username || '',
      bio: userProfile?.bio || '',
      location: userProfile?.location || '',
      website: userProfile?.website || '',
      tradingSince: userProfile?.tradingSince?.split('T')[0] || ''
    }
  });

  const onSubmit = async (data: ProfileSetupData) => {
    try {
      setIsSubmitting(true);
      
      await updateUserProfile({
        ...data,
        tradingSince: data.tradingSince ? new Date(data.tradingSince).toISOString() : undefined,
        isOnboardingComplete: true
      });
      
      onComplete();
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Complete Your Profile
        </h2>
        <p className="text-gray-600">
          Set up your social trading profile to connect with other traders
        </p>
      </div>

      <div className="flex justify-center mb-8">
        <Avatar
          src={userProfile?.photoURL}
          size="xl"
          alt={userProfile?.displayName}
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Username
          </label>
          <Input
            {...register('username')}
            placeholder="Choose a unique username"
            error={errors.username?.message}
            disabled={isSubmitting}
          />
          <p className="text-xs text-gray-500 mt-1">
            This will be your @username for mentions and your profile URL
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bio
          </label>
          <textarea
            {...register('bio')}
            placeholder="Tell other traders about yourself..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            rows={3}
            disabled={isSubmitting}
          />
          {errors.bio && (
            <p className="text-sm text-red-600 mt-1">{errors.bio.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <Input
              {...register('location')}
              placeholder="City, Country"
              error={errors.location?.message}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trading Since
            </label>
            <Input
              {...register('tradingSince')}
              type="date"
              error={errors.tradingSince?.message}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Website
          </label>
          <Input
            {...register('website')}
            placeholder="https://your-website.com"
            error={errors.website?.message}
            disabled={isSubmitting}
          />
        </div>

        <div className="flex justify-end space-x-4 pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={onComplete}
            disabled={isSubmitting}
          >
            Skip for now
          </Button>
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            Complete Profile
          </Button>
        </div>
      </form>
    </div>
  );
}
```

### 2.2 Enhanced API Routes

**Current:** Basic API structure in `/functions/src/routes/`
**Enhancement:** Add social-ready endpoints

```typescript
// functions/src/routes/profiles.ts - NEW FILE
import { Router } from 'express';
import { auth } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { profileService } from '../services/profileService';
import Joi from 'joi';

const router = Router();

// Get public profile by username
router.get('/:username', auth, async (req, res) => {
  try {
    const { username } = req.params;
    const currentUserId = req.user?.uid;
    
    const profile = await profileService.getPublicProfile(username, currentUserId);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'Profile not found'
        }
      });
    }
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch profile'
      }
    });
  }
});

// Search profiles
const searchSchema = Joi.object({
  q: Joi.string().min(1).max(50).required(),
  limit: Joi.number().min(1).max(20).default(10),
  offset: Joi.number().min(0).default(0)
});

router.get('/search', auth, validateRequest({ query: searchSchema }), async (req, res) => {
  try {
    const { q, limit, offset } = req.query;
    const currentUserId = req.user?.uid;
    
    const results = await profileService.searchProfiles(
      q as string, 
      currentUserId,
      Number(limit),
      Number(offset)
    );
    
    res.json({
      success: true,
      data: results.profiles,
      metadata: {
        total: results.total,
        hasMore: results.hasMore
      }
    });
  } catch (error) {
    console.error('Search profiles error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to search profiles'
      }
    });
  }
});

// Check username availability
router.get('/username/:username/available', auth, async (req, res) => {
  try {
    const { username } = req.params;
    const isAvailable = await profileService.isUsernameAvailable(username);
    
    res.json({
      success: true,
      data: { available: isAvailable }
    });
  } catch (error) {
    console.error('Check username error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to check username availability'
      }
    });
  }
});

export { router as profilesRouter };
```

```typescript
// functions/src/services/profileService.ts - NEW FILE
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit as firestoreLimit, 
  startAfter,
  writeBatch,
  serverTimestamp
} from 'firebase-admin/firestore';

const db = getFirestore();

export const profileService = {
  async getPublicProfile(username: string, currentUserId?: string) {
    // Get user ID from username
    const usernameDoc = await getDoc(doc(db, 'usernames', username));
    if (!usernameDoc.exists()) {
      return null;
    }
    
    const userId = usernameDoc.data().uid;
    
    // Get user profile
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return null;
    }
    
    const userData = userDoc.data();
    
    // Check if profile is public or if current user can view
    if (userData.privacy?.profileVisibility === 'private' && userId !== currentUserId) {
      return null;
    }
    
    // Get relationship status if current user is different
    let relationship = undefined;
    if (currentUserId && currentUserId !== userId) {
      relationship = await this.getRelationshipStatus(currentUserId, userId);
    }
    
    // Build public profile
    const publicProfile = {
      id: userId,
      displayName: userData.displayName,
      username: userData.username,
      bio: userData.bio,
      photoURL: userData.photoURL,
      location: userData.location,
      website: userData.website,
      tradingSince: userData.tradingSince,
      socialStats: userData.socialStats || {
        followersCount: 0,
        followingCount: 0,
        postsCount: 0
      },
      relationship
    };
    
    // Add trading stats if public
    if (userData.privacy?.showPerformanceStats !== false) {
      // Get trading stats from trades collection
      publicProfile.stats = await this.getTradingStats(userId);
    }
    
    return publicProfile;
  },

  async searchProfiles(searchTerm: string, currentUserId: string, limit = 10, offset = 0) {
    // Search by display name and username
    const usersRef = collection(db, 'users');
    const searchQuery = query(
      usersRef,
      where('privacy.profileVisibility', 'in', ['public', 'followers']),
      orderBy('displayName'),
      firestoreLimit(limit + offset)
    );
    
    const snapshot = await getDocs(searchQuery);
    const profiles = [];
    
    for (const doc of snapshot.docs) {
      const userData = doc.data();
      
      // Filter by search term
      const matchesSearch = 
        userData.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        userData.username?.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (matchesSearch && profiles.length < limit) {
        const relationship = await this.getRelationshipStatus(currentUserId, doc.id);
        
        profiles.push({
          id: doc.id,
          displayName: userData.displayName,
          username: userData.username,
          bio: userData.bio,
          photoURL: userData.photoURL,
          socialStats: userData.socialStats || {
            followersCount: 0,
            followingCount: 0,
            postsCount: 0
          },
          relationship
        });
      }
    }
    
    return {
      profiles: profiles.slice(offset),
      total: profiles.length,
      hasMore: snapshot.docs.length > limit + offset
    };
  },

  async isUsernameAvailable(username: string): Promise<boolean> {
    const usernameDoc = await getDoc(doc(db, 'usernames', username));
    return !usernameDoc.exists();
  },

  async getRelationshipStatus(currentUserId: string, targetUserId: string) {
    const [followingDoc, followerDoc, blockedDoc] = await Promise.all([
      getDoc(doc(db, 'users', currentUserId, 'following', targetUserId)),
      getDoc(doc(db, 'users', currentUserId, 'followers', targetUserId)),
      getDoc(doc(db, 'users', currentUserId, 'blocked', targetUserId))
    ]);
    
    return {
      isFollowing: followingDoc.exists(),
      isFollower: followerDoc.exists(),
      isBlocked: blockedDoc.exists(),
      isMuted: false // TODO: implement muting
    };
  },

  async getTradingStats(userId: string) {
    // This would integrate with your existing trading stats logic
    // For now, return placeholder
    return {
      totalTrades: 0,
      winRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      profitableDays: 0
    };
  }
};
```

### 2.3 Enhanced Dashboard Integration

**Current:** Trading dashboard
**Enhancement:** Add social elements preparation

```typescript
// app/components/dashboard/DashboardLayout.tsx - EXTEND existing layout
// Add social navigation elements to your existing dashboard

// Example enhancement to existing navigation:
const socialNavItems = [
  { name: 'Feed', href: '/feed', icon: Home },
  { name: 'Discover', href: '/discover', icon: Search },
  { name: 'Notifications', href: '/notifications', icon: Bell },
];

// Add these to your existing navigation structure
```

## 3. Database Schema Extensions

### 3.1 Firestore Collections to Add

```javascript
// Add these collections to your existing Firestore structure:

// Collection: usernames (for uniqueness)
// Document ID: {username}
{
  uid: "user123",
  username: "trader_mike",
  createdAt: timestamp
}

// Collection: profiles (public profile cache)  
// Document ID: {userId}
{
  displayName: "Mike Trading",
  username: "trader_mike", 
  bio: "Binary options trader since 2020",
  photoURL: "https://...",
  socialStats: {
    followersCount: 150,
    followingCount: 75,
    postsCount: 45
  },
  lastActive: timestamp,
  updatedAt: timestamp
}

// Subcollection: users/{userId}/following
// Document ID: {followedUserId}
{
  followedAt: timestamp,
  notificationsEnabled: true
}

// Subcollection: users/{userId}/followers  
// Document ID: {followerUserId}
{
  followedAt: timestamp,
  isApproved: true
}
```

## 4. API Enhancements

### 4.1 Extend Existing API Structure

```typescript
// functions/src/index.ts - ADD to your existing API exports
import { profilesRouter } from './routes/profiles';

// Add to your existing Express app:
app.use('/api/v1/profiles', profilesRouter);
```

## 5. Frontend Extensions

### 5.1 Add Social Hooks

```typescript
// app/hooks/useProfiles.ts - NEW HOOK
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profilesApi } from '@/lib/api/profiles';

export function useProfile(username: string) {
  return useQuery({
    queryKey: ['profile', username],
    queryFn: () => profilesApi.getProfile(username),
    enabled: !!username
  });
}

export function useSearchProfiles(searchTerm: string) {
  return useQuery({
    queryKey: ['profiles', 'search', searchTerm],
    queryFn: () => profilesApi.searchProfiles(searchTerm),
    enabled: searchTerm.length >= 2
  });
}

export function useCheckUsername(username: string) {
  return useQuery({
    queryKey: ['username', 'available', username],
    queryFn: () => profilesApi.checkUsernameAvailability(username),
    enabled: username.length >= 3
  });
}
```

```typescript
// app/lib/api/profiles.ts - NEW API CLIENT
const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export const profilesApi = {
  async getProfile(username: string) {
    const response = await fetch(`${API_BASE}/profiles/${username}`, {
      headers: {
        'Authorization': `Bearer ${await getIdToken()}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch profile');
    }
    
    return response.json();
  },

  async searchProfiles(searchTerm: string) {
    const response = await fetch(
      `${API_BASE}/profiles/search?q=${encodeURIComponent(searchTerm)}`,
      {
        headers: {
          'Authorization': `Bearer ${await getIdToken()}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to search profiles');
    }
    
    return response.json();
  },

  async checkUsernameAvailability(username: string) {
    const response = await fetch(
      `${API_BASE}/profiles/username/${username}/available`,
      {
        headers: {
          'Authorization': `Bearer ${await getIdToken()}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to check username');
    }
    
    return response.json();
  }
};

async function getIdToken() {
  // Use your existing auth system to get the ID token
  const auth = getAuth();
  if (auth.currentUser) {
    return auth.currentUser.getIdToken();
  }
  throw new Error('Not authenticated');
}
```

## 6. Testing Additions

### 6.1 Test Extensions for Social Features

```typescript
// functions/src/__tests__/profiles.test.ts - NEW TEST FILE
import { profileService } from '../services/profileService';

describe('Profile Service', () => {
  test('should get public profile by username', async () => {
    // Test your existing auth + new profile functionality
  });

  test('should check username availability', async () => {
    // Test username uniqueness
  });

  test('should search profiles', async () => {
    // Test profile search functionality
  });
});
```

---

## Implementation Steps Summary

**Week 1:**
1. Extend UserProfile interface with social fields
2. Add username creation to signup flow
3. Create Avatar and Badge UI components
4. Add social Firestore security rules

**Week 2:**
1. Build ProfileSetupWizard component
2. Create profiles API routes and service
3. Add profile search functionality
4. Extend database with social collections

**Week 3:**
1. Implement username availability checking
2. Add profile hooks and API clients
3. Create public profile components
4. Test all new functionality

**Week 4:**
1. Polish profile management UI
2. Add comprehensive testing
3. Prepare for Sprint 3-4 social features
4. Performance optimization

This extends your existing Binary Hub infrastructure while preparing for full social platform capabilities in the next sprints.