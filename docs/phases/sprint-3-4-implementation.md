# Binary Hub – Sprint 3-4 Implementation Guide

*Social Platform Core Features • Weeks 5-8 • January 2025*

---

## Overview

This guide details implementing the core social platform features on top of Binary Hub's existing infrastructure. We'll build the follow system, social feed, content creation, and real-time interactions while integrating with your current trading journal functionality.

**Building Upon:**
- ✅ Extended user profiles with social fields (Sprint 1-2)
- ✅ Enhanced authentication with usernames (Sprint 1-2)
- ✅ Social UI components (Avatar, Badge) (Sprint 1-2)
- ✅ Profile API routes and services (Sprint 1-2)
- ✅ Your existing trading journal and dashboard

**Sprint 3-4 Goals:**
- Implement follow/unfollow system
- Build social content creation and sharing
- Create personalized social feed
- Add real-time interactions (likes, comments)
- Integrate trading content with social features

## Table of Contents

1. [Sprint 3: Social Relationships & Content](#1-sprint-3-social-relationships--content)
2. [Sprint 4: Social Feed & Real-time Interactions](#2-sprint-4-social-feed--real-time-interactions)
3. [Trading-Social Integration](#3-trading-social-integration)
4. [Real-time Implementation](#4-real-time-implementation)
5. [Performance Optimization](#5-performance-optimization)

---

## 1. Sprint 3: Social Relationships & Content

### 1.1 Follow System Implementation

**Building on:** Your existing user management
**Adding:** Follow/unfollow relationships with real-time updates

```typescript
// functions/src/services/socialService.ts - NEW FILE
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  increment, 
  writeBatch, 
  query, 
  where, 
  orderBy, 
  limit as firestoreLimit,
  serverTimestamp,
  runTransaction
} from 'firebase-admin/firestore';

const db = getFirestore();

export const socialService = {
  async followUser(followerId: string, followedId: string) {
    if (followerId === followedId) {
      throw new Error('Cannot follow yourself');
    }

    return await runTransaction(db, async (transaction) => {
      // Check if already following
      const followingRef = doc(db, 'users', followerId, 'following', followedId);
      const followingDoc = await transaction.get(followingRef);
      
      if (followingDoc.exists()) {
        throw new Error('Already following this user');
      }

      // Check if followed user exists and get privacy settings
      const followedUserRef = doc(db, 'users', followedId);
      const followedUserDoc = await transaction.get(followedUserRef);
      
      if (!followedUserDoc.exists()) {
        throw new Error('User not found');
      }

      const followedUserData = followedUserDoc.data();
      const requiresApproval = followedUserData.privacy?.requiresFollowApproval || false;

      // Create follow relationship
      const followData = {
        followedAt: serverTimestamp(),
        notificationsEnabled: true,
        isApproved: !requiresApproval
      };

      transaction.set(followingRef, followData);

      // Create reverse relationship  
      const followerRef = doc(db, 'users', followedId, 'followers', followerId);
      transaction.set(followerRef, {
        followedAt: serverTimestamp(),
        isApproved: !requiresApproval
      });

      // Update counters only if approved
      if (!requiresApproval) {
        const followerUserRef = doc(db, 'users', followerId);
        transaction.update(followerUserRef, {
          'socialStats.followingCount': increment(1)
        });

        transaction.update(followedUserRef, {
          'socialStats.followersCount': increment(1)
        });
      }

      return {
        following: true,
        requiresApproval,
        followedAt: new Date().toISOString()
      };
    });
  },

  async unfollowUser(followerId: string, followedId: string) {
    return await runTransaction(db, async (transaction) => {
      const followingRef = doc(db, 'users', followerId, 'following', followedId);
      const followingDoc = await transaction.get(followingRef);
      
      if (!followingDoc.exists()) {
        throw new Error('Not following this user');
      }

      const wasApproved = followingDoc.data().isApproved;

      // Remove follow relationship
      transaction.delete(followingRef);

      // Remove reverse relationship
      const followerRef = doc(db, 'users', followedId, 'followers', followerId);
      transaction.delete(followerRef);

      // Update counters only if was approved
      if (wasApproved) {
        const followerUserRef = doc(db, 'users', followerId);
        transaction.update(followerUserRef, {
          'socialStats.followingCount': increment(-1)
        });

        const followedUserRef = doc(db, 'users', followedId);
        transaction.update(followedUserRef, {
          'socialStats.followersCount': increment(-1)
        });
      }

      return { following: false };
    });
  },

  async getFollowers(userId: string, currentUserId: string, limit = 20, offset = 0) {
    const followersRef = collection(db, 'users', userId, 'followers');
    const q = query(
      followersRef,
      where('isApproved', '==', true),
      orderBy('followedAt', 'desc'),
      firestoreLimit(limit)
    );

    const snapshot = await getDocs(q);
    const followers = [];

    for (const doc of snapshot.docs) {
      const followerData = doc.data();
      const followerProfile = await this.getBasicProfile(doc.id);
      
      if (followerProfile) {
        // Check if current user follows this follower
        const relationship = currentUserId !== doc.id 
          ? await this.getRelationshipStatus(currentUserId, doc.id)
          : null;

        followers.push({
          ...followerProfile,
          followedAt: followerData.followedAt,
          relationship
        });
      }
    }

    return followers;
  },

  async getFollowing(userId: string, currentUserId: string, limit = 20, offset = 0) {
    const followingRef = collection(db, 'users', userId, 'following');
    const q = query(
      followingRef,
      where('isApproved', '==', true),
      orderBy('followedAt', 'desc'),
      firestoreLimit(limit)
    );

    const snapshot = await getDocs(q);
    const following = [];

    for (const doc of snapshot.docs) {
      const followingData = doc.data();
      const followedProfile = await this.getBasicProfile(doc.id);
      
      if (followedProfile) {
        const relationship = currentUserId !== doc.id 
          ? await this.getRelationshipStatus(currentUserId, doc.id)
          : null;

        following.push({
          ...followedProfile,
          followedAt: followingData.followedAt,
          relationship
        });
      }
    }

    return following;
  },

  async getBasicProfile(userId: string) {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return null;

    const userData = userDoc.data();
    return {
      id: userId,
      displayName: userData.displayName,
      username: userData.username,
      photoURL: userData.photoURL,
      bio: userData.bio,
      socialStats: userData.socialStats || {
        followersCount: 0,
        followingCount: 0,
        postsCount: 0
      }
    };
  },

  async getRelationshipStatus(currentUserId: string, targetUserId: string) {
    const [followingDoc, followerDoc] = await Promise.all([
      getDoc(doc(db, 'users', currentUserId, 'following', targetUserId)),
      getDoc(doc(db, 'users', targetUserId, 'following', currentUserId))
    ]);

    return {
      isFollowing: followingDoc.exists() && followingDoc.data().isApproved,
      isFollower: followerDoc.exists() && followerDoc.data().isApproved,
      isPending: followingDoc.exists() && !followingDoc.data().isApproved
    };
  }
};
```

```typescript
// functions/src/routes/social.ts - NEW FILE
import { Router } from 'express';
import { auth } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { socialService } from '../services/socialService';
import Joi from 'joi';

const router = Router();

// Follow user
router.post('/follow/:userId', auth, async (req, res) => {
  try {
    const { userId: followedId } = req.params;
    const followerId = req.user!.uid;
    
    const result = await socialService.followUser(followerId, followedId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Follow user error:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'FOLLOW_ERROR',
        message: error.message
      }
    });
  }
});

// Unfollow user
router.delete('/follow/:userId', auth, async (req, res) => {
  try {
    const { userId: followedId } = req.params;
    const followerId = req.user!.uid;
    
    const result = await socialService.unfollowUser(followerId, followedId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Unfollow user error:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'UNFOLLOW_ERROR', 
        message: error.message
      }
    });
  }
});

// Get followers
const followersSchema = Joi.object({
  limit: Joi.number().min(1).max(50).default(20),
  offset: Joi.number().min(0).default(0)
});

router.get('/followers/:userId', auth, validateRequest({ query: followersSchema }), async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit, offset } = req.query;
    const currentUserId = req.user!.uid;
    
    const followers = await socialService.getFollowers(
      userId, 
      currentUserId, 
      Number(limit), 
      Number(offset)
    );
    
    res.json({
      success: true,
      data: followers
    });
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch followers'
      }
    });
  }
});

// Get following
router.get('/following/:userId', auth, validateRequest({ query: followersSchema }), async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit, offset } = req.query;
    const currentUserId = req.user!.uid;
    
    const following = await socialService.getFollowing(
      userId, 
      currentUserId, 
      Number(limit), 
      Number(offset)
    );
    
    res.json({
      success: true,
      data: following
    });
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch following'
      }
    });
  }
});

export { router as socialRouter };
```

### 1.2 Social Content Creation

**Building on:** Your existing trade management
**Adding:** Social posts and trade sharing

```typescript
// app/types/social.ts - NEW FILE
export interface Post {
  id: string;
  authorId: string;
  author: {
    id: string;
    displayName: string;
    username: string;
    photoURL: string;
  };
  type: 'trade' | 'insight' | 'achievement' | 'general';
  content: string;
  hashtags: string[];
  attachments: PostAttachment[];
  
  // Trade-specific data
  tradeRef?: string; // Reference to trade document
  tradeData?: {
    asset: string;
    direction: 'call' | 'put';
    amount: number;
    result?: 'win' | 'loss';
    payout?: number;
    entryTime: string;
  };
  
  // Engagement metrics
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  
  // User interaction state
  isLiked?: boolean;
  isBookmarked?: boolean;
  
  // Metadata
  visibility: 'public' | 'followers' | 'private';
  createdAt: string;
  updatedAt: string;
  
  // Moderation
  isReported?: boolean;
  isModerated?: boolean;
}

export interface PostAttachment {
  id: string;
  type: 'image' | 'chart' | 'screenshot';
  url: string;
  thumbnailUrl?: string;
  alt?: string;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  author: {
    id: string;
    displayName: string;
    username: string;
    photoURL: string;
  };
  content: string;
  parentId?: string; // For replies
  likesCount: number;
  isLiked?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostData {
  type: 'trade' | 'insight' | 'achievement' | 'general';
  content: string;
  hashtags?: string[];
  attachments?: string[]; // URLs of uploaded images
  tradeRef?: string;
  visibility: 'public' | 'followers' | 'private';
}
```

```typescript
// app/components/social/PostComposer.tsx - NEW COMPONENT
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Image as ImageIcon, 
  Hash, 
  TrendingUp, 
  Lock, 
  Users, 
  Globe,
  X
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';

const postSchema = z.object({
  content: z.string()
    .min(1, 'Post content is required')
    .max(500, 'Post content must be less than 500 characters'),
  hashtags: z.string().optional(),
  visibility: z.enum(['public', 'followers', 'private']),
  tradeRef: z.string().optional()
});

type PostFormData = z.infer<typeof postSchema>;

interface PostComposerProps {
  onSubmit: (data: CreatePostData) => Promise<void>;
  defaultTradeRef?: string; // When sharing a specific trade
  onCancel?: () => void;
}

export function PostComposer({ onSubmit, defaultTradeRef, onCancel }: PostComposerProps) {
  const { userProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<PostFormData>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      content: '',
      hashtags: '',
      visibility: userProfile?.socialPreferences?.defaultPostVisibility || 'followers',
      tradeRef: defaultTradeRef
    }
  });

  const content = watch('content');
  const visibility = watch('visibility');

  const handleFormSubmit = async (data: PostFormData) => {
    try {
      setIsSubmitting(true);
      
      const hashtags = data.hashtags
        ? data.hashtags.split(' ').filter(tag => tag.startsWith('#')).map(tag => tag.slice(1))
        : [];

      const postData: CreatePostData = {
        type: data.tradeRef ? 'trade' : 'general',
        content: data.content,
        hashtags,
        attachments,
        tradeRef: data.tradeRef,
        visibility: data.visibility
      };

      await onSubmit(postData);
    } catch (error) {
      console.error('Failed to create post:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleHashtagInsert = () => {
    const currentContent = content || '';
    setValue('content', currentContent + ' #');
  };

  const visibilityOptions = [
    { value: 'public', label: 'Public', icon: Globe, description: 'Anyone can see this post' },
    { value: 'followers', label: 'Followers', icon: Users, description: 'Only your followers can see this' },
    { value: 'private', label: 'Private', icon: Lock, description: 'Only you can see this' }
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      <div className="flex items-start space-x-3">
        <Avatar
          src={userProfile?.photoURL}
          alt={userProfile?.displayName}
          size="md"
        />
        
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className="font-medium text-gray-900">
              {userProfile?.displayName}
            </span>
            {userProfile?.username && (
              <span className="text-gray-500">@{userProfile.username}</span>
            )}
          </div>

          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            <div>
              <textarea
                {...register('content')}
                placeholder="Share your trading insights..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={4}
                disabled={isSubmitting}
              />
              {errors.content && (
                <p className="text-sm text-red-600 mt-1">{errors.content.message}</p>
              )}
              
              <div className="flex items-center justify-between mt-2">
                <span className={`text-xs ${content?.length > 450 ? 'text-red-500' : 'text-gray-500'}`}>
                  {content?.length || 0}/500
                </span>
              </div>
            </div>

            {defaultTradeRef && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">
                    Sharing trade details
                  </span>
                </div>
              </div>
            )}

            <div>
              <input
                {...register('hashtags')}
                placeholder="Add hashtags (e.g., #binaryoptions #trading)"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                disabled={isSubmitting}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={handleHashtagInsert}
                  className="flex items-center space-x-1 text-gray-500 hover:text-blue-600"
                  disabled={isSubmitting}
                >
                  <Hash className="h-4 w-4" />
                  <span className="text-sm">Tag</span>
                </button>
                
                <button
                  type="button"
                  className="flex items-center space-x-1 text-gray-500 hover:text-blue-600"
                  disabled={isSubmitting}
                >
                  <ImageIcon className="h-4 w-4" />
                  <span className="text-sm">Image</span>
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <select
                  {...register('visibility')}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isSubmitting}
                >
                  {visibilityOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-gray-200">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              )}
              
              <Button
                type="submit"
                loading={isSubmitting}
                disabled={isSubmitting || !content?.trim()}
              >
                Post
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
```

### 1.3 Trade Sharing Integration

**Building on:** Your existing trade management in `/app/components/trades/`
**Adding:** Social sharing capabilities

```typescript
// app/components/trades/TradeShareModal.tsx - NEW COMPONENT
'use client';

import React, { useState } from 'react';
import { Share2, TrendingUp, TrendingDown, X } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PostComposer } from '@/components/social/PostComposer';
import { formatCurrency, formatPercentage } from '@/lib/utils';

interface Trade {
  // Use your existing Trade interface from types
  id: string;
  asset: string;
  direction: 'call' | 'put';
  amount: number;
  result?: 'win' | 'loss';
  payout?: number;
  entryTime: string;
  strategy?: string;
  notes?: string;
}

interface TradeShareModalProps {
  trade: Trade;
  isOpen: boolean;
  onClose: () => void;
  onShare: (postData: any) => Promise<void>;
}

export function TradeShareModal({ trade, isOpen, onClose, onShare }: TradeShareModalProps) {
  const { userProfile } = useAuth();
  const [isSharing, setIsSharing] = useState(false);

  if (!isOpen) return null;

  const handleShare = async (postData: any) => {
    try {
      setIsSharing(true);
      await onShare({
        ...postData,
        tradeRef: trade.id
      });
      onClose();
    } catch (error) {
      console.error('Failed to share trade:', error);
    } finally {
      setIsSharing(false);
    }
  };

  const getDefaultContent = () => {
    const result = trade.result;
    const asset = trade.asset;
    const direction = trade.direction;
    
    if (result === 'win') {
      const returnPercent = trade.payout ? ((trade.payout - trade.amount) / trade.amount) * 100 : 0;
      return `🎯 Just closed a winning ${direction.toUpperCase()} on ${asset}! +${formatPercentage(returnPercent)} return. ${trade.strategy ? `Strategy: ${trade.strategy}` : ''} #binaryoptions #trading`;
    } else if (result === 'loss') {
      return `📚 Learning experience with ${direction.toUpperCase()} on ${asset}. ${trade.strategy ? `Strategy: ${trade.strategy}` : ''} Always improving! #binaryoptions #trading #learningjourney`;
    } else {
      return `📊 Just entered a ${direction.toUpperCase()} position on ${asset}. ${trade.strategy ? `Strategy: ${trade.strategy}` : ''} Let's see how it goes! #binaryoptions #trading`;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Share Trade</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isSharing}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Trade Preview */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-gray-900">{trade.asset}</span>
                <Badge 
                  variant={trade.direction === 'call' ? 'success' : 'destructive'}
                >
                  {trade.direction === 'call' ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {trade.direction.toUpperCase()}
                </Badge>
                {trade.result && (
                  <Badge variant={trade.result === 'win' ? 'success' : 'destructive'}>
                    {trade.result === 'win' ? '✓' : '✗'} {trade.result.toUpperCase()}
                  </Badge>
                )}
              </div>
              <span className="text-sm text-gray-500">
                {new Date(trade.entryTime).toLocaleDateString()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Amount:</span>
                <span className="ml-2 font-medium">{formatCurrency(trade.amount)}</span>
              </div>
              {trade.payout && (
                <div>
                  <span className="text-gray-500">Payout:</span>
                  <span className="ml-2 font-medium">{formatCurrency(trade.payout)}</span>
                </div>
              )}
              {trade.strategy && (
                <div className="col-span-2">
                  <span className="text-gray-500">Strategy:</span>
                  <span className="ml-2 font-medium">{trade.strategy}</span>
                </div>
              )}
            </div>

            {trade.notes && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <span className="text-gray-500 text-sm">Notes:</span>
                <p className="mt-1 text-sm text-gray-700">{trade.notes}</p>
              </div>
            )}
          </div>

          {/* Post Composer */}
          <PostComposer
            onSubmit={handleShare}
            defaultTradeRef={trade.id}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}
```

```typescript
// EXTEND your existing trade components to add share functionality
// Example: app/components/trades/TradeCard.tsx - ADD this to your existing component

// Add this import to your existing imports
import { TradeShareModal } from './TradeShareModal';

// Add this state to your existing component
const [showShareModal, setShowShareModal] = useState(false);

// Add this to your existing trade action buttons
<button
  onClick={() => setShowShareModal(true)}
  className="flex items-center space-x-1 text-gray-500 hover:text-blue-600"
>
  <Share2 className="h-4 w-4" />
  <span className="text-sm">Share</span>
</button>

// Add the modal at the end of your component
<TradeShareModal
  trade={trade}
  isOpen={showShareModal}
  onClose={() => setShowShareModal(false)}
  onShare={handleShareTrade}
/>
```

## 2. Sprint 4: Social Feed & Real-time Interactions

### 2.1 Social Feed Implementation

**Building on:** Your existing dashboard layout
**Adding:** Personalized social feed

```typescript
// app/components/social/SocialFeed.tsx - NEW COMPONENT
'use client';

import React, { useState, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { PostCard } from './PostCard';
import { PostComposer } from './PostComposer';
import { feedApi } from '@/lib/api/feed';

interface SocialFeedProps {
  type?: 'following' | 'trending' | 'discover';
  showComposer?: boolean;
}

export function SocialFeed({ type = 'following', showComposer = true }: SocialFeedProps) {
  const { user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch
  } = useInfiniteQuery({
    queryKey: ['feed', type],
    queryFn: ({ pageParam = null }) => feedApi.getFeed(type, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!user
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const handleCreatePost = async (postData: any) => {
    // Create post and refresh feed
    await feedApi.createPost(postData);
    await refetch();
  };

  const handleLikePost = async (postId: string) => {
    await feedApi.likePost(postId);
    // Optimistically update the UI
  };

  const handleCommentPost = async (postId: string, content: string) => {
    await feedApi.commentPost(postId, content);
    // Refresh post data
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Failed to load feed</p>
        <button
          onClick={handleRefresh}
          className="mt-2 text-blue-600 hover:text-blue-700"
        >
          Try again
        </button>
      </div>
    );
  }

  const posts = data?.pages.flatMap(page => page.posts) || [];

  return (
    <div className="space-y-6">
      {/* Feed Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          {type === 'following' && 'Following'}
          {type === 'trending' && 'Trending'}
          {type === 'discover' && 'Discover'}
        </h2>
        
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center space-x-1 text-gray-500 hover:text-gray-700"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="text-sm">Refresh</span>
        </button>
      </div>

      {/* Post Composer */}
      {showComposer && (
        <PostComposer onSubmit={handleCreatePost} />
      )}

      {/* Feed Content */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">
              {type === 'following' 
                ? 'No posts from people you follow yet. Try discovering new traders!'
                : 'No posts available. Be the first to share something!'
              }
            </p>
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onLike={handleLikePost}
              onComment={handleCommentPost}
            />
          ))
        )}

        {/* Load More */}
        {hasNextPage && (
          <div className="text-center py-4">
            <button
              onClick={handleLoadMore}
              disabled={isFetchingNextPage}
              className="flex items-center space-x-2 mx-auto px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              {isFetchingNextPage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span>Load more posts</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

### 2.2 Post Interaction Components

```typescript
// app/components/social/PostCard.tsx - NEW COMPONENT
'use client';

import React, { useState } from 'react';
import { 
  Heart, 
  MessageCircle, 
  Share, 
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  Clock
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { formatDistanceToNow } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { Post } from '@/types/social';

interface PostCardProps {
  post: Post;
  onLike: (postId: string) => void;
  onComment: (postId: string, content: string) => void;
  onShare?: (postId: string) => void;
}

export function PostCard({ post, onLike, onComment, onShare }: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isLiking, setIsLiking] = useState(false);

  const handleLike = async () => {
    if (isLiking) return;
    setIsLiking(true);
    try {
      await onLike(post.id);
    } finally {
      setIsLiking(false);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    
    await onComment(post.id, commentText);
    setCommentText('');
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      {/* Post Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <Avatar
            src={post.author.photoURL}
            alt={post.author.displayName}
            size="md"
          />
          
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-medium text-gray-900">
                {post.author.displayName}
              </span>
              <span className="text-gray-500">@{post.author.username}</span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-500 text-sm">
                {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
              </span>
            </div>
            
            {post.type !== 'general' && (
              <Badge variant="outline" className="mt-1">
                {post.type === 'trade' && <TrendingUp className="h-3 w-3 mr-1" />}
                {post.type}
              </Badge>
            )}
          </div>
        </div>
        
        <button className="text-gray-400 hover:text-gray-600">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Trade Data (if trade post) */}
      {post.type === 'trade' && post.tradeData && (
        <div className="bg-gray-50 rounded-lg p-3 border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="font-medium">{post.tradeData.asset}</span>
              <Badge variant={post.tradeData.direction === 'call' ? 'success' : 'destructive'}>
                {post.tradeData.direction === 'call' ? (
                  <TrendingUp className="h-3 w-3 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1" />
                )}
                {post.tradeData.direction.toUpperCase()}
              </Badge>
              {post.tradeData.result && (
                <Badge variant={post.tradeData.result === 'win' ? 'success' : 'destructive'}>
                  {post.tradeData.result === 'win' ? '✓' : '✗'} {post.tradeData.result.toUpperCase()}
                </Badge>
              )}
            </div>
            <div className="text-sm text-gray-500">
              {formatCurrency(post.tradeData.amount)}
            </div>
          </div>
        </div>
      )}

      {/* Post Content */}
      <div className="space-y-3">
        <p className="text-gray-900 whitespace-pre-wrap">{post.content}</p>
        
        {/* Hashtags */}
        {post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.hashtags.map((tag) => (
              <span key={tag} className="text-blue-600 hover:underline cursor-pointer">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Attachments */}
        {post.attachments.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            {post.attachments.map((attachment) => (
              <img
                key={attachment.id}
                src={attachment.url}
                alt={attachment.alt}
                className="rounded-lg object-cover aspect-video"
              />
            ))}
          </div>
        )}
      </div>

      {/* Post Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center space-x-6">
          <button
            onClick={handleLike}
            disabled={isLiking}
            className={`flex items-center space-x-1 transition-colors ${
              post.isLiked 
                ? 'text-red-600 hover:text-red-700' 
                : 'text-gray-500 hover:text-red-600'
            }`}
          >
            <Heart className={`h-4 w-4 ${post.isLiked ? 'fill-current' : ''}`} />
            <span className="text-sm">{post.likesCount}</span>
          </button>
          
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center space-x-1 text-gray-500 hover:text-blue-600"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="text-sm">{post.commentsCount}</span>
          </button>
          
          {onShare && (
            <button
              onClick={() => onShare(post.id)}
              className="flex items-center space-x-1 text-gray-500 hover:text-green-600"
            >
              <Share className="h-4 w-4" />
              <span className="text-sm">{post.sharesCount}</span>
            </button>
          )}
        </div>
        
        <div className="flex items-center space-x-1 text-gray-400 text-xs">
          <Clock className="h-3 w-3" />
          <span>{formatDistanceToNow(new Date(post.createdAt))}</span>
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="pt-3 border-t border-gray-100 space-y-3">
          {/* Comment Form */}
          <form onSubmit={handleComment} className="flex space-x-3">
            <Avatar size="sm" />
            <div className="flex-1">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={!commentText.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Post
            </button>
          </form>
          
          {/* Comments List - TODO: Implement comments display */}
          <div className="text-sm text-gray-500">
            Comments implementation coming in next iteration
          </div>
        </div>
      )}
    </div>
  );
}
```

This completes Sprint 3-4 core implementation. Should I continue with the remaining sections (Real-time Implementation, Performance Optimization) or move on to Sprint 5-6 (AI Integration)?