'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/contexts/AuthContext'
import { 
  SharedTrade, 
  CommunityFeed, 
  TradeShareData, 
  CommunityStats,
  TradeComment,
  UseCommunityFeedOptions 
} from '@/types/community'

const API_BASE = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:5004/v1' 
  : '/api/v1'

// Hook for community feed
export function useCommunityFeed(options: UseCommunityFeedOptions = {}) {
  const [feed, setFeed] = useState<CommunityFeed | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const fetchFeed = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (options.filters?.timeframe) params.append('timeframe', options.filters.timeframe)
      if (options.filters?.asset) params.append('asset', options.filters.asset)
      if (options.filters?.result) params.append('result', options.filters.result)
      if (options.filters?.sortBy) params.append('sortBy', options.filters.sortBy)

      const token = await user.getIdToken()
      const response = await fetch(`${API_BASE}/community/feed?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch community feed: ${response.status}`)
      }

      const data = await response.json()
      if (data.success) {
        setFeed(data.data)
      } else {
        throw new Error(data.message || 'Failed to fetch community feed')
      }
    } catch (err) {
      console.error('Error fetching community feed:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (options.enabled !== false) {
      fetchFeed()
    }
  }, [user, options.enabled, JSON.stringify(options.filters)])

  const refetch = () => {
    fetchFeed()
  }

  return {
    feed,
    loading,
    error,
    refetch
  }
}

// Interface for creating posts
export interface CreatePostData {
  type: 'text' | 'trade-share' | 'poll' | 'ai-question' | 'market-analysis'
  content: string
  tradeId?: string
  poll?: {
    question: string
    options: { id: string; text: string }[]
    duration: number
  }
  aiQuestion?: {
    question: string
    context?: string
  }
  tags: string[]
  privacy: 'public' | 'followers' | 'private'
  shareToFeed: boolean
  notifyFollowers: boolean
}

// Hook for creating community posts
export function useCreatePost() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const createPost = async (postData: CreatePostData): Promise<any | null> => {
    if (!user) {
      setError('User not authenticated')
      return null
    }

    try {
      setLoading(true)
      setError(null)

      const token = await user.getIdToken()
      const response = await fetch(`${API_BASE}/community/create-post`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(postData)
      })

      if (!response.ok) {
        throw new Error(`Failed to create post: ${response.status}`)
      }

      const data = await response.json()
      if (data.success) {
        return data.data
      } else {
        throw new Error(data.message || 'Failed to create post')
      }
    } catch (err) {
      console.error('Error creating post:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      return null
    } finally {
      setLoading(false)
    }
  }

  return {
    createPost,
    loading,
    error
  }
}

// Hook for sharing a trade
export function useShareTrade() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const shareTrade = async (shareData: TradeShareData): Promise<SharedTrade | null> => {
    if (!user) {
      setError('User not authenticated')
      return null
    }

    try {
      setLoading(true)
      setError(null)

      const token = await user.getIdToken()
      const response = await fetch(`${API_BASE}/community/share-trade`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(shareData)
      })

      if (!response.ok) {
        throw new Error(`Failed to share trade: ${response.status}`)
      }

      const data = await response.json()
      if (data.success) {
        return data.data
      } else {
        throw new Error(data.message || 'Failed to share trade')
      }
    } catch (err) {
      console.error('Error sharing trade:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      return null
    } finally {
      setLoading(false)
    }
  }

  return {
    shareTrade,
    loading,
    error
  }
}

// Hook for liking trades
export function useLikeTrade() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const toggleLike = async (tradeId: string): Promise<boolean | null> => {
    if (!user) {
      setError('User not authenticated')
      return null
    }

    try {
      setLoading(true)
      setError(null)

      const token = await user.getIdToken()
      const response = await fetch(`${API_BASE}/community/trades/${tradeId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to like trade: ${response.status}`)
      }

      const data = await response.json()
      if (data.success) {
        return data.data.liked
      } else {
        throw new Error(data.message || 'Failed to like trade')
      }
    } catch (err) {
      console.error('Error liking trade:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      return null
    } finally {
      setLoading(false)
    }
  }

  return {
    toggleLike,
    loading,
    error
  }
}

// Hook for adding comments
export function useAddComment() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const addComment = async (tradeId: string, content: string, parentId?: string): Promise<TradeComment | null> => {
    if (!user) {
      setError('User not authenticated')
      return null
    }

    try {
      setLoading(true)
      setError(null)

      const token = await user.getIdToken()
      const response = await fetch(`${API_BASE}/community/trades/${tradeId}/comment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content, parentId })
      })

      if (!response.ok) {
        throw new Error(`Failed to add comment: ${response.status}`)
      }

      const data = await response.json()
      if (data.success) {
        return data.data
      } else {
        throw new Error(data.message || 'Failed to add comment')
      }
    } catch (err) {
      console.error('Error adding comment:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      return null
    } finally {
      setLoading(false)
    }
  }

  return {
    addComment,
    loading,
    error
  }
}

// Hook for getting a specific shared trade
export function useSharedTrade(tradeId: string | null) {
  const [trade, setTrade] = useState<SharedTrade | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    if (!tradeId || !user) {
      setTrade(null)
      setLoading(false)
      return
    }

    const fetchTrade = async () => {
      try {
        setLoading(true)
        setError(null)

        const token = await user.getIdToken()
        const response = await fetch(`${API_BASE}/community/trades/${tradeId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch shared trade: ${response.status}`)
        }

        const data = await response.json()
        if (data.success) {
          setTrade(data.data)
        } else {
          throw new Error(data.message || 'Failed to fetch shared trade')
        }
      } catch (err) {
        console.error('Error fetching shared trade:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchTrade()
  }, [tradeId, user])

  return {
    trade,
    loading,
    error
  }
}

// Hook for community stats
export function useCommunityStats(timeframe: '24h' | '7d' | '30d' = '24h') {
  const [stats, setStats] = useState<CommunityStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return

    const fetchStats = async () => {
      try {
        setLoading(true)
        setError(null)

        const token = await user.getIdToken()
        const response = await fetch(`${API_BASE}/community/stats?timeframe=${timeframe}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch community stats: ${response.status}`)
        }

        const data = await response.json()
        if (data.success) {
          setStats(data.data)
        } else {
          throw new Error(data.message || 'Failed to fetch community stats')
        }
      } catch (err) {
        console.error('Error fetching community stats:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [user, timeframe])

  return {
    stats,
    loading,
    error
  }
}