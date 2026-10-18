// Lean rebuild shim - no Firebase API calls for community features
'use client';

import { useState, useEffect } from 'react';
import {
  SharedTrade,
  CommunityFeed,
  TradeShareData,
  CommunityStats,
  TradeComment,
  UseCommunityFeedOptions,
} from '@/types/community';

// Hook for community feed
export function useCommunityFeed(_options: UseCommunityFeedOptions = {}) {
  const [feed] = useState<CommunityFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);

  useEffect(() => {
    // Simulate loading completion
    const timer = setTimeout(() => setLoading(false), 100);
    return () => clearTimeout(timer);
  }, []);

  const refetch = () => {
    console.log('useCommunityFeed: Lean rebuild mode - no API calls');
  };

  return {
    feed,
    loading,
    error,
    refetch,
  };
}

// Interface for creating posts
export interface CreatePostData {
  type: 'text' | 'trade-share' | 'poll' | 'ai-question' | 'market-analysis';
  content: string;
  tradeId?: string;
  poll?: {
    question: string;
    options: { id: string; text: string }[];
    duration: number;
  };
  aiQuestion?: {
    question: string;
    context?: string;
  };
  tags: string[];
  privacy: 'public' | 'followers' | 'private';
  shareToFeed: boolean;
  notifyFollowers: boolean;
}

// Hook for creating community posts
export function useCreatePost() {
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);

  const createPost = async (_postData: CreatePostData): Promise<unknown | null> => {
    console.warn('useCreatePost: Community features not available in lean rebuild');
    return null;
  };

  return {
    createPost,
    loading,
    error,
  };
}

// Hook for sharing a trade
export function useShareTrade() {
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);

  const shareTrade = async (_shareData: TradeShareData): Promise<SharedTrade | null> => {
    console.warn('useShareTrade: Community features not available in lean rebuild');
    return null;
  };

  return {
    shareTrade,
    loading,
    error,
  };
}

// Hook for liking trades
export function useLikeTrade() {
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);

  const toggleLike = async (_tradeId: string): Promise<boolean | null> => {
    console.warn('useLikeTrade: Community features not available in lean rebuild');
    return null;
  };

  return {
    toggleLike,
    loading,
    error,
  };
}

// Hook for adding comments
export function useAddComment() {
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);

  const addComment = async (
    _tradeId: string,
    _content: string,
    _parentId?: string
  ): Promise<TradeComment | null> => {
    console.warn('useAddComment: Community features not available in lean rebuild');
    return null;
  };

  return {
    addComment,
    loading,
    error,
  };
}

// Hook for getting a specific shared trade
export function useSharedTrade(_tradeId: string | null) {
  const [trade] = useState<SharedTrade | null>(null);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 100);
    return () => clearTimeout(timer);
  }, []);

  return {
    trade,
    loading,
    error,
  };
}

// Hook for community stats
export function useCommunityStats(_timeframe: '24h' | '7d' | '30d' = '24h') {
  const [stats] = useState<CommunityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 100);
    return () => clearTimeout(timer);
  }, []);

  return {
    stats,
    loading,
    error,
  };
}
